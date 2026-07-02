import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { TransliterationService } from "@/app/services/transliterationService";
import { checkAIUsage, incrementUsage } from "@/app/services/aiUsageService";

// Vision extraction over a full menu photo can exceed Vercel's 10s default.
export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-5";
const BULK_USAGE_COST = 2; // Bulk import counts as 2 AI uses
const MAX_TEXT_LENGTH = 500;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

interface ExtractedWord {
  english: string;
  arabic: string;
  transliteration: string;
  type: "noun" | "verb" | "adjective" | "phrase";
}

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

    const { text, image } = await req.json();

    if (!text && !image) {
      return NextResponse.json(
        { error: "Text or image is required" },
        { status: 400 }
      );
    }

    // Validate input size
    if (text && text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text must be less than ${MAX_TEXT_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (image) {
      // Image is base64 - rough size check
      const imageSize = Math.ceil((image.length * 3) / 4);
      if (imageSize > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          { error: "Image must be less than 5MB" },
          { status: 400 }
        );
      }
    }

    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check AI usage limits (need at least 2 remaining)
    const usageCheck = await checkAIUsage(user.id);
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: usageCheck.reason, limitReached: true },
        { status: 429 }
      );
    }

    // Check if we have enough for bulk (2 uses)
    if (usageCheck.remaining !== undefined && usageCheck.remaining < BULK_USAGE_COST) {
      return NextResponse.json(
        {
          error: `Bulk import requires ${BULK_USAGE_COST} AI uses. You have ${usageCheck.remaining} remaining.`,
          limitReached: true,
        },
        { status: 429 }
      );
    }

    // Get transliteration rules
    const transliterationRules =
      await TransliterationService.getTransliterationPrompt();

    const prompt = `Extract vocabulary words from the provided content and translate each to Lebanese Arabic.

${transliterationRules}

Guidelines:
- Extract meaningful vocabulary words (nouns, verbs, adjectives) and short phrases
- Skip articles (the, a, an), common prepositions, and pronouns unless part of a phrase
- Maximum 20 words
- Ensure translations are in Lebanese Arabic dialect, not Modern Standard Arabic

Return ONLY a JSON array with this exact structure:
[
  {
    "english": "the English word",
    "arabic": "the Arabic translation",
    "transliteration": "pronunciation following the rules above",
    "type": "noun" | "verb" | "adjective" | "phrase"
  }
]

No additional text or explanations. Just the JSON array.`;

    // Build message content based on whether we have text or image
    type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    let content: Anthropic.MessageCreateParams["messages"][0]["content"];

    if (image) {
      // Determine media type from base64 prefix or default to jpeg
      let mediaType: ImageMediaType = "image/jpeg";
      let imageData = image;

      if (image.startsWith("data:")) {
        const match = image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const detectedType = match[1];
          if (detectedType === "image/png" || detectedType === "image/jpeg" ||
              detectedType === "image/gif" || detectedType === "image/webp") {
            mediaType = detectedType;
          }
          imageData = match[2];
        }
      }

      content = [
        {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mediaType,
            data: imageData,
          },
        },
        { type: "text" as const, text: prompt },
      ];
    } else {
      content = `${prompt}\n\nContent to extract from:\n${text}`;
    }

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content }],
    });

    if (!message.content || message.content.length === 0) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    try {
      // Parse the JSON response - handle potential markdown code blocks
      let jsonStr = responseText.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      }

      const words: ExtractedWord[] = JSON.parse(jsonStr);

      // Validate and limit to 20 words
      const validWords = words
        .filter(
          (w) =>
            w.english &&
            w.arabic &&
            w.transliteration &&
            ["noun", "verb", "adjective", "phrase"].includes(w.type)
        )
        .slice(0, 20);

      // Increment usage by 2 for bulk
      await incrementUsage(user.id);
      await incrementUsage(user.id);

      return NextResponse.json({ words: validWords });
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Bulk extract error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage || "Failed to process request" },
      { status: 500 }
    );
  }
}
