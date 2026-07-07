import { NextResponse } from "next/server";
import { errorMessage } from "@/app/api/utils";
import { ALLOWED_LICENSES, getImageBankAccess, isAllowedLicense } from "../shared";

// Searches Openverse (free, CC-licensed image API) for candidate photos for
// a concept. Anonymous access is rate-limited but fine at curation volume.

const OPENVERSE_URL = "https://api.openverse.org/v1/images/";

interface OpenverseResult {
  id: string;
  title?: string;
  creator?: string;
  license: string;
  license_version?: string;
  license_url?: string;
  url: string;
  thumbnail?: string;
  attribution?: string;
  foreign_landing_url?: string;
}

export async function GET(req: Request) {
  try {
    const access = await getImageBankAccess(req);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const query = new URL(req.url).searchParams.get("concept")?.trim();
    if (!query) {
      return NextResponse.json({ error: "Missing concept" }, { status: 400 });
    }

    const params = new URLSearchParams({
      q: query,
      license: ALLOWED_LICENSES.join(","),
      page_size: "12",
    });
    const response = await fetch(`${OPENVERSE_URL}?${params}`, {
      headers: { "User-Agent": "YallaFlash/1.0 (https://yallaflash.com; image bank curation)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: `Openverse returned ${response.status}` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { results?: OpenverseResult[] };
    // The license query param already filters, but the license gate is the
    // whole point of this route -- re-check each result before returning it.
    const candidates = (data.results ?? [])
      .filter((r) => r.url && isAllowedLicense(r.license))
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        title: r.title ?? null,
        creator: r.creator ?? null,
        license: r.license,
        licenseVersion: r.license_version ?? null,
        licenseUrl: r.license_url ?? null,
        url: r.url,
        thumbnail: r.thumbnail ?? r.url,
        attribution: r.attribution ?? null,
        sourceUrl: r.foreign_landing_url ?? null,
      }));

    return NextResponse.json({ candidates });
  } catch (error) {
    console.error("[v2/images/discover]", error);
    return NextResponse.json(
      { error: `Image search failed: ${errorMessage(error)}` },
      { status: 500 }
    );
  }
}
