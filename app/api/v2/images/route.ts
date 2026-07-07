import { NextResponse } from "next/server";
import { errorMessage } from "@/app/api/utils";
import { getImageBankAccess, isAllowedLicense } from "./shared";

// GET  -> concepts (distinct word english) that have no bank image
// POST -> add a picked image to the bank under its concept key

export async function GET(req: Request) {
  try {
    const access = await getImageBankAccess(req);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const [imagesRes, wordsRes] = await Promise.all([
      access.serviceClient.from("v2_images").select("concept").limit(10000),
      access.serviceClient.from("v2_words").select("english").limit(10000),
    ]);
    if (imagesRes.error) throw imagesRes.error;
    if (wordsRes.error) throw wordsRes.error;

    const bank = (imagesRes.data ?? []).map((row) => row.concept as string);
    const bankSet = new Set(bank);

    // Mirrors findImageForWord in app/v2/lib/tools.ts: a word is covered if
    // its concept matches exactly or appears as a substring of a bank concept.
    const hasImage = (english: string) => {
      const concept = english.toLowerCase().trim();
      if (bankSet.has(concept)) return true;
      const safeConcept = concept.replace(/[,()%_]/g, " ").trim();
      if (!safeConcept) return false;
      return bank.some((c) => c.includes(safeConcept));
    };

    const wordCounts = new Map<string, number>();
    for (const row of wordsRes.data ?? []) {
      const english = (row.english as string | null) ?? "";
      const concept = english.toLowerCase().trim();
      if (!concept || hasImage(english)) continue;
      wordCounts.set(concept, (wordCounts.get(concept) ?? 0) + 1);
    }

    const missing = Array.from(wordCounts.entries())
      .map(([concept, wordCount]) => ({ concept, wordCount }))
      .sort((a, b) => b.wordCount - a.wordCount || a.concept.localeCompare(b.concept));

    return NextResponse.json({ missing, bankSize: bank.length });
  } catch (error) {
    console.error("[v2/images GET]", error);
    return NextResponse.json(
      { error: `Loading image bank failed: ${errorMessage(error)}` },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await getImageBankAccess(req);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = (await req.json()) as {
      concept?: unknown;
      url?: unknown;
      license?: unknown;
      attribution?: unknown;
      sourceUrl?: unknown;
    };

    const concept = typeof body.concept === "string" ? body.concept.toLowerCase().trim() : "";
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!concept || !/^https?:\/\//.test(url)) {
      return NextResponse.json({ error: "Missing concept or image url" }, { status: 400 });
    }
    if (!isAllowedLicense(body.license)) {
      return NextResponse.json(
        { error: "Only cc0, by, and by-sa licensed images can be added" },
        { status: 400 }
      );
    }

    const { data, error } = await access.serviceClient
      .from("v2_images")
      .upsert(
        {
          concept,
          url,
          source: "openverse",
          license: body.license,
          attribution: typeof body.attribution === "string" ? body.attribution : null,
          source_url: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
        },
        { onConflict: "concept" }
      )
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ image: data });
  } catch (error) {
    console.error("[v2/images POST]", error);
    return NextResponse.json(
      { error: `Saving image failed: ${errorMessage(error)}` },
      { status: 500 }
    );
  }
}
