import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";

import { loginSchema, type LoginInput } from "@/shared/schemas/auth";
import { prisma } from "@/server/db/client";

export async function authenticateUser(input: LoginInput, role: UserRole) {
  const payload = loginSchema.parse(input);

  const user = await prisma.user.findFirst({
    where: {
      role,
      OR: [{ loginName: payload.identifier }, { phone: payload.identifier }],
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  const isPasswordValid = await bcrypt.compare(payload.password, user.passwordHash);
  if (!isPasswordValid) {
    return null;
  }

  return user;
}
