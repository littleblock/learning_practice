import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/shared/constants/app";

export const statuteListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

export const statuteUploadMetadataSchema = z.object({
  title: z.string().trim().min(2, "资料标题至少 2 位").max(120, "资料标题过长"),
});

export type StatuteUploadMetadata = z.infer<typeof statuteUploadMetadataSchema>;
