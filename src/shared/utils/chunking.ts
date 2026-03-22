import { CHUNK_OVERLAP, CHUNK_SIZE } from "@/shared/constants/app";

export interface TextChunk {
  index: number;
  content: string;
  preview: string;
}

export function chunkText(
  content: string,
  chunkSize = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP,
) {
  const normalized = content.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [] as TextChunk[];
  }

  const result: TextChunk[] = [];
  let cursor = 0;
  let index = 0;

  while (cursor < normalized.length) {
    const slice = normalized.slice(cursor, cursor + chunkSize).trim();
    if (slice) {
      result.push({
        index,
        content: slice,
        preview: slice.slice(0, 120),
      });
      index += 1;
    }

    if (cursor + chunkSize >= normalized.length) {
      break;
    }

    cursor += Math.max(chunkSize - overlap, 1);
  }

  return result;
}
