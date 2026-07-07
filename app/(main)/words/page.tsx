"use client";

import { V2Gate } from "@/app/v2/components/V2Gate";
import { WordsTable } from "@/app/v2/components/WordsTable";

export default function WordsPage() {
  return (
    <V2Gate>
      <WordsTable />
    </V2Gate>
  );
}
