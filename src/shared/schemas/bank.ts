import { BankStatus } from "@prisma/client";
import { z } from "zod";

import { BANK_CODE_PATTERN } from "@/shared/utils/bank-code";

export const bankListQuerySchema = z.object({
  keyword: z.string().trim().optional(),
  status: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.nativeEnum(BankStatus).optional(),
  ),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const bankCodeSchema = z
  .string()
  .trim()
  .min(2, "题库编码至少 2 位")
  .max(50, "题库编码过长")
  .regex(BANK_CODE_PATTERN, "题库编码仅支持字母、数字、下划线和中划线");

export const createBankSchema = z.object({
  code: bankCodeSchema.optional(),
  name: z.string().trim().min(2, "题库名称至少 2 位").max(100, "题库名称过长"),
  description: z.string().trim().max(500, "题库简介过长").optional(),
});

export const updateBankSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "题库名称至少 2 位")
    .max(100, "题库名称过长")
    .optional(),
  description: z.string().trim().max(500, "题库简介过长").nullable().optional(),
  status: z.nativeEnum(BankStatus).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export type CreateBankInput = z.infer<typeof createBankSchema>;
export type UpdateBankInput = z.infer<typeof updateBankSchema>;
