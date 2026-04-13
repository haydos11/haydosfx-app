import {
  getCompletedAnalysesForDate,
  getDigestRow,
  getLatestAnalysisDate,
  type CachedAnalysisRow,
  type DigestRow,
} from "@/lib/cot/digest";

export type MarketResearchCotResult = {
  analysisDate: string | null;
  digest: DigestRow | null;
  analyses: CachedAnalysisRow[];
};

export async function getCotResearchForDate(
  requestedDate?: string
): Promise<MarketResearchCotResult> {
  const analysisDate = requestedDate ?? (await getLatestAnalysisDate());

  if (!analysisDate) {
    return {
      analysisDate: null,
      digest: null,
      analyses: [],
    };
  }

  const [digest, analyses] = await Promise.all([
    getDigestRow(analysisDate),
    getCompletedAnalysesForDate(analysisDate),
  ]);

  return {
    analysisDate,
    digest,
    analyses,
  };
}