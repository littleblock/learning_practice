"use client";

import { Button } from "antd";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    await fetch(`/api/admin/statutes/${documentId}`, {
      method: "DELETE",
    });

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Button danger loading={isPending} onClick={handleDelete}>
      删除资料
    </Button>
  );
}
