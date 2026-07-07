export type TextChunkingOptions = {
  chunkOverlap?: number;
  chunkSize?: number;
};

export type TextChunk = {
  content: string;
  index: number;
};

const DEFAULT_CHUNK_SIZE = 480;
const DEFAULT_CHUNK_OVERLAP = 96;

export function getTextChunkingOptions(): Required<TextChunkingOptions> {
  const chunkSize = Number(process.env.KNOWLEDGE_CHUNK_SIZE ?? DEFAULT_CHUNK_SIZE);
  const chunkOverlap = Number(process.env.KNOWLEDGE_CHUNK_OVERLAP ?? DEFAULT_CHUNK_OVERLAP);

  return {
    chunkSize: Number.isFinite(chunkSize) && chunkSize >= 120 ? Math.floor(chunkSize) : DEFAULT_CHUNK_SIZE,
    chunkOverlap: Number.isFinite(chunkOverlap) && chunkOverlap >= 0 ? Math.floor(chunkOverlap) : DEFAULT_CHUNK_OVERLAP
  };
}

function splitLongText(text: string, chunkSize: number, chunkOverlap: number, startIndex = 0): TextChunk[] {
  const chunks: TextChunk[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const end = Math.min(text.length, cursor + chunkSize);
    const content = text.slice(cursor, end).trim();
    if (content) {
      chunks.push({ content, index: startIndex + chunks.length });
    }
    if (end >= text.length) {
      break;
    }
    cursor = Math.max(cursor + 1, end - chunkOverlap);
  }

  return chunks;
}

export function splitTextIntoChunks(text: string, options: TextChunkingOptions = {}): TextChunk[] {
  const { chunkSize, chunkOverlap } = {
    ...getTextChunkingOptions(),
    ...options
  };
  const overlap = Math.min(Math.max(0, chunkOverlap), chunkSize - 1);
  const normalized = text.trim().replace(/\r\n/g, "\n");
  if (!normalized) {
    return [];
  }

  if (normalized.length <= chunkSize) {
    return [{ content: normalized, index: 0 }];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: TextChunk[] = [];
  let buffer = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > chunkSize) {
      if (buffer) {
        chunks.push({ content: buffer, index: chunks.length });
        buffer = "";
      }
      chunks.push(...splitLongText(paragraph, chunkSize, overlap, chunks.length));
      continue;
    }

    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length <= chunkSize) {
      buffer = candidate;
      continue;
    }

    if (buffer) {
      chunks.push({ content: buffer, index: chunks.length });
    }
    buffer = paragraph;
  }

  if (buffer) {
    chunks.push({ content: buffer, index: chunks.length });
  }

  return chunks.map((chunk, index) => ({ ...chunk, index }));
}

export function buildVectorChunkId(sourceId: string, chunkIndex: number, chunkCount: number) {
  if (chunkCount <= 1) {
    return `vector-${sourceId}`;
  }

  return `vector-${sourceId}--${chunkIndex}`;
}
