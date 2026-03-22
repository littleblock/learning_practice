import { QuestionType } from "@prisma/client";

import type {
  QuestionImportDraftInput,
  QuestionImportRow,
  UpsertQuestionInput,
} from "@/shared/schemas/question";

export type NormalizedQuestionInput = Omit<UpsertQuestionInput, "sortOrder"> & {
  sortOrder?: number;
};

export type NormalizedImportQuestionType = QuestionImportRow["question_type"];

const defaultJudgeOptions = [
  { label: "A", text: "正确" },
  { label: "B", text: "错误" },
] as const;

function normalizeComparableText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[()（）]/g, "")
    .replace(/[\s_-]+/g, "");
}

function mapNormalizedQuestionTypeToEnum(type: NormalizedImportQuestionType) {
  switch (type) {
    case "single":
      return QuestionType.SINGLE;
    case "multiple":
      return QuestionType.MULTIPLE;
    case "judge":
      return QuestionType.JUDGE;
    default:
      return QuestionType.SINGLE;
  }
}

function normalizeAnswerToken(
  token: string,
  questionType: NormalizedImportQuestionType,
) {
  const normalized = token.trim();
  if (!normalized) {
    return [] as string[];
  }

  const upper = normalized.toUpperCase();
  if (/^\d+$/.test(upper)) {
    const numericValue = Number(upper);
    if (numericValue >= 1 && numericValue <= 26) {
      return [String.fromCharCode(64 + numericValue)];
    }
  }

  if (/^[A-Z]$/.test(upper)) {
    return [upper];
  }

  if (/^[A-Z]+$/.test(upper)) {
    return upper.split("");
  }

  if (questionType === "judge") {
    const comparable = normalizeComparableText(normalized);
    if (
      ["对", "正确", "是", "true", "t", "y", "yes", "√"].includes(comparable)
    ) {
      return ["A"];
    }

    if (
      ["错", "错误", "否", "false", "f", "n", "no", "×", "x"].includes(
        comparable,
      )
    ) {
      return ["B"];
    }
  }

  return [] as string[];
}

function normalizeCorrectAnswers(
  value: string,
  questionType: NormalizedImportQuestionType,
  optionLabels: string[],
) {
  const normalized = value.trim();
  if (!normalized) {
    return [] as string[];
  }

  const answers = normalized
    .split(/[\s,，;；、/]+/)
    .flatMap((item) => normalizeAnswerToken(item, questionType));

  if (answers.length > 0) {
    return Array.from(
      new Set(answers.filter((item) => optionLabels.includes(item))),
    );
  }

  return Array.from(
    new Set(
      normalizeAnswerToken(normalized, questionType).filter((item) =>
        optionLabels.includes(item),
      ),
    ),
  );
}

export function normalizeImportQuestionTypeValue(
  value: string,
): NormalizedImportQuestionType {
  const comparable = normalizeComparableText(value);

  if (["single", "singlechoice", "单选", "单选题"].includes(comparable)) {
    return "single";
  }

  if (["multiple", "multiplechoice", "多选", "多选题"].includes(comparable)) {
    return "multiple";
  }

  if (
    ["judge", "truefalse", "boolean", "判断", "判断题"].includes(comparable)
  ) {
    return "judge";
  }

  throw new Error(`无法识别题目类型: ${value || "空值"}`);
}

export function looksLikeLawSource(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 255) {
    return false;
  }

  return (
    /第.{1,10}条/.test(normalized) ||
    /(条例|办法|规定|细则|规范)$/.test(normalized)
  );
}

export function mapImportRowToQuestionInput(
  row: QuestionImportRow,
): NormalizedQuestionInput {
  const options = ["a", "b", "c", "d", "e", "f"]
    .map((suffix, index) => {
      const value = row[`option_${suffix}` as keyof QuestionImportRow];
      return value
        ? {
            label: String.fromCharCode(65 + index),
            text: String(value),
          }
        : null;
    })
    .filter((item): item is { label: string; text: string } => Boolean(item));

  const normalizedOptions =
    options.length > 0
      ? options
      : row.question_type === "judge"
        ? [...defaultJudgeOptions]
        : options;
  const correctAnswers = normalizeCorrectAnswers(
    row.correct_answer,
    row.question_type,
    normalizedOptions.map((item) => item.label),
  );

  if (correctAnswers.length === 0) {
    throw new Error(`无法识别正确答案: ${row.correct_answer}`);
  }

  return {
    type: mapNormalizedQuestionTypeToEnum(row.question_type),
    stem: row.stem,
    options: normalizedOptions,
    correctAnswers,
    analysis: row.analysis || null,
    lawSource: row.law_source || null,
    sortOrder: row.sort_order,
  };
}

export function normalizeQuestionInput(
  input:
    | UpsertQuestionInput
    | QuestionImportDraftInput
    | NormalizedQuestionInput,
) {
  return {
    type: input.type,
    stem: input.stem.trim(),
    options: input.options.map((item) => ({
      label: item.label.trim().toUpperCase(),
      text: item.text.trim(),
    })),
    correctAnswers: input.correctAnswers.map((item) =>
      item.trim().toUpperCase(),
    ),
    analysis: input.analysis?.trim() || null,
    lawSource: input.lawSource?.trim() || null,
    sortOrder: input.sortOrder,
  };
}
