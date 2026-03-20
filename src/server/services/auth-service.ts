import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";

import { loginSchema, type LoginInput } from "@/shared/schemas/auth";
import { prisma } from "@/server/db/client";

const DUMMY_HASH = "$2a$10$K4GByGBaQ0ijk0.Dp5R5duMPmSBnSGpAwnRQdOqZ5AQKUV1jGS0Ky";

export async function authenticateUser(input: LoginInput, role: UserRole) {
  const payload = loginSchema.parse(input);

  const user = await prisma.user.findFirst({
    where: {
      role,
      OR: [{ loginName: payload.identifier }, { phone: payload.identifier }],
    },
  });

  const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
  const isPasswordValid = await bcrypt.compare(payload.password, hashToCompare);

  if (!user || user.status !== "ACTIVE" || !isPasswordValid) {
    return null;
  }

  return user;
}
