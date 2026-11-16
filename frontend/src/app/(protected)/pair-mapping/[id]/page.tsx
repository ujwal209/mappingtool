"use client";

import UnifiedMappingStudioPage from "@/app/(protected)/table-matching/[id]/page";

/**
 * Unified Studio Page for Pair Mapping.
 * Instead of separate fragmented pages, renders the full Unified Data Mapping Studio
 * combining Table Alignment, Interactive Column Mapping, and the Human Review Gate.
 */
export default function PairMappingPage() {
  return <UnifiedMappingStudioPage />;
}
