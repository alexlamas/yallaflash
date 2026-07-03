import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { arabic, transliteration, english, context } = await request.json();

    if (!arabic || !english) {
      return NextResponse.json(
        { error: "Arabic and English are required" },
        { status: 400 }
      );
    }

    const contextLine = context ? `\nAdditional instructions: ${context}` : "";

    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Generate a short, engaging Instagram caption for a "Word of the Day" post teaching Lebanese Arabic.

Word: ${arabic} (${transliteration}) - "${english}"${contextLine}

Requirements:
- Start with an engaging hook or question
- Include a brief example of how to use the word in a sentence (in Lebanese Arabic with translation)
- Keep it casual and fun
- End with a call to action (save, share, or follow)
- Add 5-8 relevant hashtags at the end
- IMPORTANT: Output plain text only. Do NOT use any markdown formatting (no **bold**, no *italics*, no bullet points, no headers). Instagram doesn't support markdown.

Keep the total caption under 200 words. Don't use emojis excessively.`,
        },
      ],
    });

    const caption =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ caption });
  } catch (error) {
    console.error("Error generating caption:", error);
    return NextResponse.json(
      { error: "Failed to generate caption" },
      { status: 500 }
    );
  }
}
