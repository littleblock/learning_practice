import { z } from "zod";

export const statuteListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const statuteUploadMetadataSchema = z.object({
  title: z.string().trim().min(2, "资料标题至少 2 位").max(120, "资料标题过长"),
});

export type StatuteUploadMetadata = z.infer<typeof statuteUploadMetadataSchema>;
