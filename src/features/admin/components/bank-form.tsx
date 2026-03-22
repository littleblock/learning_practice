"use client";

import { Button, Input } from "antd";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface BankFormProps {
  mode: "create" | "edit";
  bankId?: string;
  redirectTo?: string;
  initialValues?: {
    code?: string;
    name?: string;
    description?: string | null;
    sortOrder?: number;
  };
  submitText?: string;
  onSuccess?: () => void;
}

export function BankForm({
  mode,
  bankId,
  redirectTo,
  initialValues,
  submitText,
  onSuccess,
}: BankFormProps) {
  const router = useRouter();
  const [code, setCode] = useState(initialValues?.code ?? "");
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [sortOrder, setSortOrder] = useState(initialValues?.sortOrder ?? 0);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, startRefreshTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        mode === "create" ? "/api/admin/banks" : `/api/admin/banks/${bankId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            mode === "create"
              ? {
                  name,
                  description,
                }
              : {
                  name,
                  description,
                  sortOrder,
                },
          ),
        },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(
          payload.message ??
            (mode === "create" ? "创建题库失败" : "更新题库失败"),
        );
        return;
      }

      if (mode === "create" && !redirectTo) {
        setCode(payload.code ?? "");
        setName("");
        setDescription("");
        setSortOrder(0);
        setSuccessMessage(
          payload.code ? `题库已创建，编码为 ${payload.code}` : "题库已创建",
        );
      } else {
        setSuccessMessage(mode === "create" ? "题库已创建" : "题库信息已更新");
      }

      onSuccess?.();
      if (redirectTo) {
        router.replace(redirectTo);
        return;
      }

      startRefreshTransition(() => {
        router.refresh();
      });
    } catch {
      setErrorMessage(mode === "create" ? "创建题库失败" : "更新题库失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      <Input
        placeholder={
          mode === "create"
            ? "系统将自动生成题库编码，例如 TK-202603-00000001"
            : "题库编码"
        }
        value={code}
        readOnly
      />
      <Input
        placeholder="题库名称"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Input.TextArea
        placeholder="题库简介"
        value={description}
        rows={3}
        onChange={(event) => setDescription(event.target.value)}
      />
      {mode === "edit" ? (
        <Input
          type="number"
          placeholder="排序值"
          value={String(sortOrder)}
          onChange={(event) => setSortOrder(Number(event.target.value || 0))}
        />
      ) : null}
      {errorMessage ? (
        <div style={{ color: "var(--danger)" }}>{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div style={{ color: "var(--success)" }}>{successMessage}</div>
      ) : null}
      <Button
        type="primary"
        htmlType="submit"
        loading={isSubmitting || isRefreshing}
        disabled={!name || isSubmitting || isRefreshing}
      >
        {submitText ?? (mode === "create" ? "创建题库" : "保存修改")}
      </Button>
    </form>
  );
}
