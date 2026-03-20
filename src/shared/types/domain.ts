import type {
  DocumentProcessStatus,
  PracticeMode,
  PracticeSessionStatus,
  PracticeSourceType,
  QuestionType,
} from "@prisma/client";

export interface QuestionOption {
  label: string;
  text: string;
}

export interface PracticeQuestionView {
  itemId: string;
  questionId: string;
  sequence: number;
  type: QuestionType;
  stem: string;
  options: QuestionOption[];
  selectedAnswers: string[];
  correctAnswers: string[];
  analysis: string | null;
  lawSource: string | null;
  isCorrect: boolean | null;
  matchedExcerpt: string | null;
  matchedScore: number | null;
}

export interface PracticeSessionView {
  id: string;
  bankId: string;
  bankName: string;
  sourceType: PracticeSourceType;
  practiceMode: PracticeMode;
  status: PracticeSessionStatus;
  currentIndex: number;
  totalCount: number;
  submittedCount: number;
  currentQuestion: PracticeQuestionView | null;
}

export interface BankSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  totalQuestions: number;
  answeredQuestions: number;
  accuracyRate: number;
  wrongBookCount: number;
  progressRate: number;
  resumeSessionId: string | null;
}

export interface WrongBookSummary {
  bankId: string;
  bankName: string;
  wrongCount: number;
  lastAnsweredAt: string | null;
  latestPracticeStatus: string;
  resumeSessionId: string | null;
}

export interface QuestionListItem {
  id: string;
  type: QuestionType;
  stem: string;
  options: QuestionOption[];
  correctAnswers: string[];
  analysis: string | null;
  lawSource: string | null;
  sortOrder: number;
  updatedAt: string;
}

export interface StatuteDocumentListItem {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  status: DocumentProcessStatus;
  lastError: string | null;
  createdAt: string;
}
