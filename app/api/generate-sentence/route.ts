import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { ClaudeService } from "@/app/services/claudeService";
import { checkAIUsage, incrementUsage } from "@/app/services/aiUsageService";
import { validateRequest } from "../utils";
import { TransliterationService } from "@/app/services/transliterationService";

type SentenceRequest = {
  word: string;
  english?: string;
  type?: string;
  notes?: string;
  existingData?: {
    arabic?: string;
    transliteration?: string;
    english?: string;
  };
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient(cookies());

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const usageCheck = await checkAIUsage(user.id);
    if (!usageCheck.allowed) {
      return Response.json(
        { error: usageCheck.reason, limitReached: true },
        { status: 429 }
      );
    }

    const data = await req.json();

    if (!validateRequest<SentenceRequest>(data, ["word"])) {
      return Response.json(
        { error: "Word is required" },
        { status: 400 }
      );
    }

    const { word, english, type, notes, existingData } = data;
    const isStreaming = req.headers.get("Accept") === "text/event-stream";

    if (isStreaming) {
      const transliterationPrompt = await TransliterationService.getTransliterationPrompt();
      const prompt = buildPrompt(word, english, type, notes, existingData, transliterationPrompt);
      const stream = ClaudeService.createStreamingMessage(prompt);

      incrementUsage(user.id);

      const encoder = new TextEncoder();
      let accumulated = "";

      const readable = new ReadableStream({
        async start(controller) {
          const reader = stream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              accumulated += value;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: value, partial: accumulated })}\n\n`));
            }
            try {
              const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
              const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(accumulated);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, result: parsed })}\n\n`));
            } catch {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Invalid response format" })}\n\n`));
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const sentence = await ClaudeService.generateSentence(word, english, type, notes, existingData);
    await incrementUsage(user.id);
    return Response.json(sentence);
  } catch {
    return Response.json(
      { error: "Failed to generate sentence" },
      { status: 500 }
    );
  }
}

function buildPrompt(
  word: string,
  english?: string,
  type?: string,
  notes?: string,
  existingData?: { arabic?: string; transliteration?: string; english?: string },
  transliterationPrompt?: string
): string {
  const contextInfo = [];
  if (type) contextInfo.push(`Word type: ${type}`);
  if (notes) contextInfo.push(`Additional notes: ${notes}`);

  const contextSection = contextInfo.length > 0
    ? `\nContext information about the word:\n${contextInfo.join("\n")}\n`
    : "";

  const hasExistingEnglish = existingData?.english && existingData.english.trim().length > 0;
  const hasExistingTransliteration = existingData?.transliteration && existingData.transliteration.trim().length > 0;
  const hasExistingArabic = existingData?.arabic && existingData.arabic.trim().length > 0;

  const existingFields = [];
  if (hasExistingEnglish) existingFields.push(`English: "${existingData!.english}"`);
  if (hasExistingTransliteration) existingFields.push(`Transliteration: "${existingData!.transliteration}"`);
  if (hasExistingArabic) existingFields.push(`Arabic: "${existingData!.arabic}"`);

  const existingSection = existingFields.length > 0
    ? `\nProvided sentence parts:\n${existingFields.join("\n")}\n`
    : "";

  if (existingFields.length > 0) {
    return `You are an AI assistant specialized in Lebanese Arabic language education. Your task is to complete or gently correct an example sentence.

Word to include: "${word}"${contextSection}${existingSection}

Your task:
1. If all three fields are provided, make only minimal corrections if there are obvious errors
2. If some fields are missing, generate them based on the provided ones
3. Ensure the word "${word}" appears naturally in the sentence
4. Keep as close as possible to the provided content - only change what's necessary

Guidelines:
- Preserve the original meaning and structure when possible
- Only correct clear grammatical errors or unnatural phrasing
- Ensure consistency between all three versions (Arabic, transliteration, English)
- Be culturally appropriate

${transliterationPrompt || ""}

Return ONLY a JSON object with this exact structure:
{
  "arabic": "${hasExistingArabic ? existingData!.arabic : "The sentence in Arabic script"}",
  "transliteration": "${hasExistingTransliteration ? existingData!.transliteration : "The Lebanese Arabic pronunciation"}",
  "english": "${hasExistingEnglish ? existingData!.english : "The English translation"}"
}

Fill in any missing fields and make minimal corrections to existing ones if needed.
No additional text or explanations. Just the JSON.`;
  }

  const meaningContext = english ? `\nEnglish meaning: "${english}"` : "";

  return `You are an AI assistant specialized in Lebanese Arabic language education. Your task is to generate an example sentence using a given Arabic word.

Arabic word: "${word}"${meaningContext}${contextSection}

Create a simple, clear example sentence in Lebanese Arabic that uses this word naturally.

Guidelines:
- Keep the sentence short and simple (5-10 words)
- Use ONLY common, everyday vocabulary (water, food, house, go, come, want, have, good, bad, big, small, etc.)
- Ensure the sentence is grammatically correct and natural in Lebanese Arabic
- Use the context provided to choose the correct meaning if the word has multiple meanings
- Be culturally appropriate
- Vary sentence structures for creativity

${transliterationPrompt || ""}

Return ONLY a JSON object with this exact structure:
{
  "arabic": "The sentence in Arabic script",
  "transliteration": "The Lebanese Arabic pronunciation",
  "english": "The English translation"
}

No additional text or explanations. Just the JSON.`;
}
