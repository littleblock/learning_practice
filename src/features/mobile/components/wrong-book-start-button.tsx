"use client";

import { PracticeSourceType } from "@prisma/client";

import { StartPracticeForm } from "@/features/mobile/components/start-practice-form";

export function WrongBookStartButton({ bankId }: { bankId: string }) {
  return (
    <StartPracticeForm
      bankId={bankId}
      sourceType={PracticeSourceType.WRONG_BOOK}
      buttonText="开始错题练习"
    />
  );
}
