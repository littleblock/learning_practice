"use client";

import { Button, Input } from "antd";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

export function StatuteUploadForm({ bankId }: { bankId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, startRefreshTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUploading) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setErrorMessage("请选择要上传的资料文件");
      return;
    }

    const formData = new FormData();
    formData.append("bankId", bankId);
    formData.append("title", title || file.name);
    formData.append("file", file);

    setIsUploading(true);

    try {
      const response = await fetch("/api/admin/statutes/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(payload.message ?? "上传失败");
        return;
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setTitle("");
      setSuccessMessage("资料已上传，系统会异步拆分文本并重建法条匹配结果。");
      startRefreshTransition(() => {
        router.refresh();
      });
    } catch {
      setErrorMessage("上传失败，请稍后重试");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      <Input
        placeholder="资料标题，可选"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <input ref={fileInputRef} type="file" accept=".txt,.md,.docx,.pdf" />
      {errorMessage ? (
        <div style={{ color: "var(--danger)" }}>{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div style={{ color: "var(--success)" }}>{successMessage}</div>
      ) : null}
      <Button
        htmlType="submit"
        type="primary"
        loading={isUploading || isRefreshing}
        disabled={isUploading || isRefreshing}
      >
        上传资料
      </Button>
    </form>
  );
}
