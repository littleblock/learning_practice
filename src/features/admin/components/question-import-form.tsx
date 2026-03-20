"use client";

import { Button, Input } from "antd";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

export function QuestionImportForm({ bankId }: { bankId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setErrorMessage("请选择 Excel 文件。");
      return;
    }

    const formData = new FormData();
    formData.append("bankId", bankId);
    formData.append("file", file);

    const response = await fetch("/api/admin/questions/import", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      setErrorMessage(payload.message ?? "导入失败");
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setSuccessMessage("导题任务已提交，可在下方查看最近执行结果。");

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      <Input
        readOnly
        value="模板字段：question_type、stem、option_a 至 option_f、correct_answer、analysis、law_source、sort_order"
      />
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" />
      {errorMessage ? <div style={{ color: "var(--danger)" }}>{errorMessage}</div> : null}
      {successMessage ? <div style={{ color: "var(--success)" }}>{successMessage}</div> : null}
      <Button htmlType="submit" loading={isPending}>
        上传 Excel
      </Button>
    </form>
  );
}
