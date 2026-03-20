"use client";

import { QuestionType } from "@prisma/client";
import { Button, Card, Input, Select, Space } from "antd";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface QuestionOption {
  label: string;
  text: string;
}

interface AdminQuestionRecord {
  id: string;
  type: QuestionType;
  stem: string;
  options: QuestionOption[];
  correctAnswers: string[];
  analysis: string | null;
  lawSource: string | null;
  sortOrder: number;
}

interface QuestionFormState {
  type: QuestionType;
  stem: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  optionF: string;
  correctAnswers: string;
  analysis: string;
  lawSource: string;
  sortOrder: number;
}

const emptyForm: QuestionFormState = {
  type: QuestionType.SINGLE,
  stem: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  optionE: "",
  optionF: "",
  correctAnswers: "",
  analysis: "",
  lawSource: "",
  sortOrder: 1,
};

function toFormState(question?: AdminQuestionRecord): QuestionFormState {
  if (!question) {
    return emptyForm;
  }

  const optionMap = new Map(question.options.map((item) => [item.label, item.text]));

  return {
    type: question.type,
    stem: question.stem,
    optionA: optionMap.get("A") ?? "",
    optionB: optionMap.get("B") ?? "",
    optionC: optionMap.get("C") ?? "",
    optionD: optionMap.get("D") ?? "",
    optionE: optionMap.get("E") ?? "",
    optionF: optionMap.get("F") ?? "",
    correctAnswers: question.correctAnswers.join(","),
    analysis: question.analysis ?? "",
    lawSource: question.lawSource ?? "",
    sortOrder: question.sortOrder,
  };
}

export function QuestionManager({
  bankId,
  questions,
}: {
  bankId: string;
  questions: AdminQuestionRecord[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<QuestionFormState>(emptyForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const nextSortOrder = Math.max(1, ...questions.map((item) => item.sortOrder + 1));

  async function submitQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const options = ["A", "B", "C", "D", "E", "F"]
      .map((label) => ({
        label,
        text: formState[`option${label}` as keyof QuestionFormState] as string,
      }))
      .filter((item) => item.text.trim().length > 0);

    const payload = {
      type: formState.type,
      stem: formState.stem,
      options,
      correctAnswers: formState.correctAnswers
        .split(/[、,，\s]+/)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
      analysis: formState.analysis || null,
      lawSource: formState.lawSource || null,
      sortOrder: Number(formState.sortOrder),
    };

    const endpoint = editingId ? `/api/admin/questions/${editingId}` : `/api/admin/questions?bankId=${bankId}`;
    const method = editingId ? "PATCH" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as { message?: string };
    if (!response.ok) {
      setErrorMessage(result.message ?? "保存题目失败");
      return;
    }

    setEditingId(null);
    setFormState({
      ...emptyForm,
      sortOrder: nextSortOrder,
    });
    startTransition(() => {
      router.refresh();
    });
  }

  async function deleteQuestion(questionId: string) {
    await fetch(`/api/admin/questions/${questionId}`, {
      method: "DELETE",
    });

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="list-grid">
      <Card title={editingId ? "编辑题目" : "新增题目"}>
        <form onSubmit={submitQuestion} style={{ display: "grid", gap: 12 }}>
          <Select
            value={formState.type}
            options={[
              { value: QuestionType.SINGLE, label: "单选题" },
              { value: QuestionType.MULTIPLE, label: "多选题" },
              { value: QuestionType.JUDGE, label: "判断题" },
            ]}
            onChange={(value) =>
              setFormState((current) => ({
                ...current,
                type: value as QuestionType,
              }))
            }
          />
          <Input.TextArea
            rows={4}
            placeholder="题干"
            value={formState.stem}
            onChange={(event) => setFormState((current) => ({ ...current, stem: event.target.value }))}
          />
          <Space.Compact direction="vertical" style={{ width: "100%" }}>
            {["A", "B", "C", "D", "E", "F"].map((label) => (
              <Input
                key={label}
                placeholder={`选项 ${label}`}
                value={formState[`option${label}` as keyof QuestionFormState] as string}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    [`option${label}`]: event.target.value,
                  }))
                }
              />
            ))}
          </Space.Compact>
          <Input
            placeholder="正确答案，多个答案可用逗号分隔"
            value={formState.correctAnswers}
            onChange={(event) =>
              setFormState((current) => ({ ...current, correctAnswers: event.target.value }))
            }
          />
          <Input
            placeholder="法律来源"
            value={formState.lawSource}
            onChange={(event) => setFormState((current) => ({ ...current, lawSource: event.target.value }))}
          />
          <Input.TextArea
            rows={3}
            placeholder="解析"
            value={formState.analysis}
            onChange={(event) => setFormState((current) => ({ ...current, analysis: event.target.value }))}
          />
          <Input
            type="number"
            placeholder="题目排序"
            value={String(formState.sortOrder)}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                sortOrder: Number(event.target.value || nextSortOrder),
              }))
            }
          />
          {errorMessage ? <div style={{ color: "var(--danger)" }}>{errorMessage}</div> : null}
          <Space>
            <Button type="primary" htmlType="submit" loading={isPending}>
              {editingId ? "保存修改" : "新增题目"}
            </Button>
            {editingId ? (
              <Button
                onClick={() => {
                  setEditingId(null);
                  setFormState({ ...emptyForm, sortOrder: nextSortOrder });
                }}
              >
                取消编辑
              </Button>
            ) : null}
          </Space>
        </form>
      </Card>

      {questions.map((question) => (
        <Card
          key={question.id}
          title={`#${question.sortOrder} ${question.stem}`}
          extra={
            <span>
              {question.type === QuestionType.SINGLE
                ? "单选题"
                : question.type === QuestionType.MULTIPLE
                  ? "多选题"
                  : "判断题"}
            </span>
          }
        >
          <div className="list-grid">
            <div>正确答案：{question.correctAnswers.join("、")}</div>
            <div>法律来源：{question.lawSource || "未填写"}</div>
            <div>解析：{question.analysis || "未填写"}</div>
            <div>选项：{question.options.map((item) => `${item.label}. ${item.text}`).join(" / ")}</div>
            <Space>
              <Button
                onClick={() => {
                  setEditingId(question.id);
                  setFormState(toFormState(question));
                }}
              >
                编辑
              </Button>
              <Button danger onClick={() => deleteQuestion(question.id)}>
                删除
              </Button>
            </Space>
          </div>
        </Card>
      ))}
    </div>
  );
}
