"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MissingConcept {
  concept: string;
  wordCount: number;
}

interface Candidate {
  id: string;
  title: string | null;
  creator: string | null;
  license: string;
  licenseVersion: string | null;
  licenseUrl: string | null;
  url: string;
  thumbnail: string;
  attribution: string | null;
  sourceUrl: string | null;
}

function licenseLabel(candidate: Pick<Candidate, "license" | "licenseVersion">) {
  const name = candidate.license === "cc0" ? "CC0" : `CC ${candidate.license.toUpperCase()}`;
  return candidate.licenseVersion ? `${name} ${candidate.licenseVersion}` : name;
}

export default function AdminImagesPage() {
  const [missing, setMissing] = useState<MissingConcept[]>([]);
  const [bankSize, setBankSize] = useState<number | null>(null);
  const [isLoadingMissing, setIsLoadingMissing] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [searchOverride, setSearchOverride] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMissing() {
      try {
        const response = await fetch("/api/v2/images");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Request failed");
        setMissing(data.missing ?? []);
        setBankSize(data.bankSize ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Loading words failed");
      } finally {
        setIsLoadingMissing(false);
      }
    }
    loadMissing();
  }, []);

  const search = useCallback(async (query: string) => {
    setIsSearching(true);
    setCandidates([]);
    setError(null);
    try {
      const response = await fetch(`/api/v2/images/discover?concept=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Request failed");
      setCandidates(data.candidates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image search failed");
    } finally {
      setIsSearching(false);
    }
  }, []);

  const selectConcept = useCallback(
    (concept: string) => {
      setSelected(concept);
      setSearchOverride("");
      setJustSaved(null);
      search(concept);
    },
    [search]
  );

  async function pick(candidate: Candidate) {
    if (!selected || savingUrl) return;
    setSavingUrl(candidate.url);
    setError(null);
    try {
      const response = await fetch("/api/v2/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: selected,
          url: candidate.url,
          license: candidate.license,
          attribution: candidate.attribution,
          sourceUrl: candidate.sourceUrl,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Request failed");

      const remaining = missing.filter((m) => m.concept !== selected);
      setMissing(remaining);
      setBankSize((size) => (size === null ? size : size + 1));
      setCandidates([]);
      // Move straight to the next word so curation flows without extra clicks.
      // Set the saved banner after advancing: selectConcept clears it.
      const next = remaining[0]?.concept ?? null;
      if (next) {
        selectConcept(next);
      } else {
        setSelected(null);
      }
      setJustSaved(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saving image failed");
    } finally {
      setSavingUrl(null);
    }
  }

  return (
    <div className="p-4 pt-12 max-w-5xl mx-auto">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-lg font-semibold">Image bank</h1>
        {bankSize !== null && (
          <span className="text-sm text-gray-400">{bankSize.toLocaleString()} images in the bank</span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Words without a review-card image, with photo suggestions from Openverse. Only CC0, CC BY and
        CC BY-SA photos are offered; attribution is saved with each pick.
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {justSaved && (
        <div className="mb-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <Check className="w-4 h-4" />
          Image saved for “{justSaved}”
        </div>
      )}

      <div className="grid md:grid-cols-[240px_1fr] gap-6 items-start">
        {/* Words missing an image */}
        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b text-sm text-gray-500">
            {isLoadingMissing ? "Loading words…" : `${missing.length} words without an image`}
          </div>
          <div className="max-h-[32rem] overflow-y-auto">
            {isLoadingMissing ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : missing.length === 0 ? (
              <div className="px-4 py-8 text-sm text-gray-400 text-center">
                Every word has an image
              </div>
            ) : (
              missing.map((item) => (
                <button
                  key={item.concept}
                  onClick={() => selectConcept(item.concept)}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-2 border-b last:border-b-0 transition-colors ${
                    selected === item.concept ? "bg-gray-100" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="truncate">{item.concept}</span>
                  {item.wordCount > 1 && (
                    <span className="text-xs text-gray-400 shrink-0">{item.wordCount} words</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Candidates */}
        <div className="bg-white border rounded-2xl p-5 min-h-[16rem]">
          {!selected ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">
              Pick a word to see photo suggestions
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-base font-medium">Photos for “{selected}”</h2>
                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (searchOverride.trim()) search(searchOverride.trim());
                  }}
                >
                  <Input
                    value={searchOverride}
                    onChange={(event) => setSearchOverride(event.target.value)}
                    placeholder="Try different search words"
                    className="h-9 w-56"
                  />
                  <Button type="submit" size="sm" variant="outline" disabled={isSearching}>
                    <Search className="w-4 h-4 mr-1" /> Search
                  </Button>
                </form>
              </div>

              {isSearching ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : candidates.length === 0 ? (
                <div className="text-sm text-gray-400 py-12 text-center">
                  No photos found — try different search words above
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {candidates.map((candidate) => (
                    <div key={candidate.id} className="group">
                      <button
                        onClick={() => pick(candidate)}
                        disabled={savingUrl !== null}
                        className="relative w-full aspect-square rounded-xl overflow-hidden border bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-70"
                        title="Use this photo"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={candidate.thumbnail}
                          alt={candidate.title ?? selected}
                          className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                        {savingUrl === candidate.url && (
                          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                          </span>
                        )}
                      </button>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-gray-500">
                        <span className="truncate">
                          {candidate.creator ? `${candidate.creator} · ` : ""}
                          {licenseLabel(candidate)}
                        </span>
                        {candidate.sourceUrl && (
                          <a
                            href={candidate.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-gray-400 hover:text-gray-600 shrink-0"
                            title="View source"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
