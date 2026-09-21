import { uid } from "@/data/orgStore";
import type { EvidenceFile } from "@/data/strategyStore";

/** Per-file cap: evidence is stored as data URLs inside the localStorage budget. */
export const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;

export interface EvidenceSkip {
  name: string;
  reason: "too-large" | "unreadable";
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export async function readEvidenceFiles(
  files: File[],
  uploadedBy: string,
): Promise<{ added: EvidenceFile[]; skipped: EvidenceSkip[] }> {
  const added: EvidenceFile[] = [];
  const skipped: EvidenceSkip[] = [];
  for (const file of files) {
    if (file.size > MAX_EVIDENCE_BYTES) {
      skipped.push({ name: file.name, reason: "too-large" });
      continue;
    }
    try {
      added.push({
        id: uid("ev"),
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: await readAsDataUrl(file),
        uploadedAt: new Date().toISOString(),
        uploadedBy,
      });
    } catch {
      skipped.push({ name: file.name, reason: "unreadable" });
    }
  }
  return { added, skipped };
}
