import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "请输入账号或手机号").max(50, "账号长度过长"),
  password: z.string().min(6, "密码至少 6 位").max(128, "密码长度过长"),
});

export type LoginInput = z.infer<typeof loginSchema>;
