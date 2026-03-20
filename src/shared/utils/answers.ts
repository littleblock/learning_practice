import { QuestionType } from "@prisma/client";

export function normalizeAnswerValues(values: string[]) {
  return [
    ...new Set(values.map((item) => item.trim().toUpperCase()).filter(Boolean)),
  ].sort();
}

export function isAnswerCorrect(
  type: QuestionType,
  selectedAnswers: string[],
  correctAnswers: string[],
) {
  const selected = normalizeAnswerValues(selectedAnswers);
  const correct = normalizeAnswerValues(correctAnswers);

  if (type === QuestionType.MULTIPLE) {
    return (
      selected.length === correct.length &&
      selected.every((item, index) => item === correct[index])
    );
  }

  return selected[0] === correct[0];
}

export function getQuestionTypeLabel(type: QuestionType) {
  switch (type) {
    case QuestionType.SINGLE:
      return "单选题";
    case QuestionType.MULTIPLE:
      return "多选题";
    case QuestionType.JUDGE:
      return "判断题";
    default:
      return "未知题型";
  }
}
