"use client";

import { BankForm } from "@/features/admin/components/bank-form";

export function BankCreateForm({ redirectTo }: { redirectTo?: string }) {
  return <BankForm mode="create" redirectTo={redirectTo} />;
}
