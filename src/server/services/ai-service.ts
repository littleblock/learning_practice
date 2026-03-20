import { getServerEnv } from "@/server/env";
import { logger } from "@/server/logger";

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
}

function createDeterministicEmbedding(text: string, dimension: number) {
  const vector = new Array<number>(dimension).fill(0);

  for (let index = 0; index < text.length; index += 1) {
    const target = index % dimension;
    vector[target] += text.charCodeAt(index) / 65535;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(8)));
}

export function vectorToSqlLiteral(vector: number[]) {
  return `[${vector.map((value) => value.toFixed(8)).join(",")}]`;
}

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) {
    return [] as number[][];
  }

  const env = getServerEnv();

  if (!env.AI_API_KEY) {
    logger.warn("未配置 AI_API_KEY，法条匹配将退化为本地确定性向量。");
    const dimension = Math.min(env.AI_EMBED_DIMENSION, 128);
    return texts.map((text) => createDeterministicEmbedding(text, dimension));
  }

  const response = await fetch(`${env.AI_BASE_URL.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.AI_EMBED_MODEL,
      input: texts,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding 接口调用失败: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as EmbeddingResponse;
  return payload.data.sort((left, right) => left.index - right.index).map((item) => item.embedding);
}
