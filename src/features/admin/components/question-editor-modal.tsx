"use client";

import { QuestionType } from "@prisma/client";
import { Button, Input, Modal, Select, Space } from "antd";
import { useEffect, useState } from "react";

import type { QuestionListItem } from "@/shared/types/domain";
import { getQuestionTypeLabel } from "@/shared/utils/answers";

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

function toFormState(
  question?: QuestionListItem,
  nextSortOrder = 1,
): QuestionFormState {
  if (!question) {
    return {
      ...emptyForm,
      sortOrder: nextSortOrder,
    };
  }

  const optionMap = new Map(
    question.options.map((item) => [item.label, item.text]),
  );

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

export function QuestionEditorModal({
  bankId,
  open,
  question,
  nextSortOrder,
  onClose,
  onSuccess,
}: {
  bankId: string;
  open: boolean;
  question?: QuestionListItem | null;
  nextSortOrder: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formState, setFormState] = useState<QuestionFormState>(() =>
    toFormState(undefined, nextSortOrder),
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setErrorMessage("");
      return;
    }

    setFormState(toFormState(question ?? undefined, nextSortOrder));
    setErrorMessage("");
  }, [nextSortOrder, open, question]);

  async function handleSubmit() {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
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
          .split(/[\s,，;；、|/]+/)
          .map((item) => item.trim().toUpperCase())
          .filter(Boolean),
        analysis: formState.analysis || null,
        lawSource: formState.lawSource || null,
        sortOrder: Number(formState.sortOrder),
      };

      const endpoint = question
        ? `/api/admin/questions/${question.id}`
        : `/api/admin/questions?bankId=${bankId}`;
      const method = question ? "PATCH" : "POST";

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

      onSuccess();
      onClose();
    } catch (error) {
      console.error("保存题目失败", error);
      setErrorMessage("保存题目失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title={question ? `编辑题目 #${question.sortOrder}` : "新增题目"}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={880}
    >
      <div className="list-grid">
        <Select
          value={formState.type}
          options={[
            {
              value: QuestionType.SINGLE,
              label: getQuestionTypeLabel(QuestionType.SINGLE),
            },
            {
              value: QuestionType.MULTIPLE,
              label: getQuestionTypeLabel(QuestionType.MULTIPLE),
            },
            {
              value: QuestionType.JUDGE,
              label: getQuestionTypeLabel(QuestionType.JUDGE),
            },
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
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              stem: event.target.value,
            }))
          }
        />
        <Space.Compact direction="vertical" style={{ width: "100%" }}>
          {["A", "B", "C", "D", "E", "F"].map((label) => (
            <Input
              key={label}
              placeholder={`选项 ${label}`}
              value={
                formState[`option${label}` as keyof QuestionFormState] as string
              }
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
          placeholder="正确答案，多个答案请用逗号分隔"
          value={formState.correctAnswers}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              correctAnswers: event.target.value,
            }))
          }
        />
        <Input
          placeholder="答案来源"
          value={formState.lawSource}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              lawSource: event.target.value,
            }))
          }
        />
        <Input.TextArea
          rows={3}
          placeholder="解析"
          value={formState.analysis}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              analysis: event.target.value,
            }))
          }
        />
        <Input
          type="number"
          placeholder="序号"
          value={String(formState.sortOrder)}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              sortOrder: Number(event.target.value || nextSortOrder),
            }))
          }
        />
        {errorMessage ? (
          <div style={{ color: "var(--danger)" }}>{errorMessage}</div>
        ) : null}
        <div className="inline-actions">
          <Button
            type="primary"
            onClick={() => void handleSubmit()}
            loading={isSubmitting}
          >
            {question ? "保存修改" : "创建题目"}
          </Button>
          <Button onClick={onClose} disabled={isSubmitting}>
            取消
          </Button>
        </div>
      </div>
    </Modal>
  );
}
