/**
 * Owned customers may read their in-house report, but must not receive raw vendor payloads.
 * Keep the existing redaction for all unrelated verification documents.
 */
export function customerDocumentData(docType: string, value: unknown): Record<string, unknown> | null {
  if (docType !== "bsa_analysis" || !value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (data.source !== "in_house") return null;
  return { source: "in_house", bsaResult: data.bsaResult, fileName: data.fileName, warnings: data.warnings };
}
