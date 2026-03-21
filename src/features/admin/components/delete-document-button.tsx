"use client";

import { Button } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (isDeleting) {
      return;
    }

    if (!window.confirm("删除资料后将同步移除解析结果，确认删除吗？")) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/statutes/${documentId}`, {
        method: "DELETE",
      });
      const payload = (await response
        .json()
        .catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        window.alert(payload.message ?? "删除资料失败");
        return;
      }

      router.refresh();
    } catch {
      window.alert("删除资料失败，请稍后重试");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Button danger loading={isDeleting} onClick={handleDelete}>
      删除资料
    </Button>
  );
}
