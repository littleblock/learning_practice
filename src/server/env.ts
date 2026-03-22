import path from "node:path";

import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "缺少 DATABASE_URL"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET 至少 16 位"),
  AI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  AI_API_KEY: z.string().default(""),
  AI_EMBED_MODEL: z.string().default("text-embedding-3-small"),
  AI_EMBED_DIMENSION: z.coerce.number().int().min(8).default(1536),
  AI_SPLIT_BASE_URL: z
    .string()
    .url()
    .default("https://coding.dashscope.aliyuncs.com/v1"),
  AI_SPLIT_API_KEY: z.string().default(""),
  AI_SPLIT_MODEL: z.string().default("glm-4.7"),
  AI_SPLIT_TIMEOUT_MS: z.coerce.number().int().min(1000).default(60000),
  AI_SPLIT_MAX_RETRIES: z.coerce.number().int().min(1).max(5).default(2),
  AI_SPLIT_CONCURRENCY_INITIAL: z.coerce.number().int().min(1).default(3),
  AI_SPLIT_CONCURRENCY_MIN: z.coerce.number().int().min(1).default(1),
  AI_SPLIT_CONCURRENCY_MAX: z.coerce.number().int().min(1).default(6),
  AI_SPLIT_SCALE_UP_SUCCESS_THRESHOLD: z.coerce
    .number()
    .int()
    .min(1)
    .default(6),
  AI_SPLIT_RATE_LIMIT_COOLDOWN_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .default(15000),
  AI_SPLIT_CHUNK_ROW_LIMIT: z.coerce.number().int().min(1).default(8),
  AI_SPLIT_CHUNK_TEXT_LIMIT: z.coerce.number().int().min(200).default(5000),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  ENABLE_SENTRY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SENTRY_DSN: z.string().default(""),
  UPLOAD_DIR: z.string().default("./storage/uploads"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`环境变量配置不完整: ${parsed.error.message}`);
  }

  cachedEnv = {
    ...parsed.data,
    UPLOAD_DIR: path.resolve(parsed.data.UPLOAD_DIR),
  };

  return cachedEnv;
}
