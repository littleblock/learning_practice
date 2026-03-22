import type {
  DocumentProcessStatus,
  PracticeMode,
  PracticeSessionStatus,
  PracticeSourceType,
  QuestionImportBatchStatus,
  QuestionImportSourceStatus,
  QuestionImportTemplateType,
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

export interface PracticeAiExplanationView {
  questionId: string;
  content: string;
  usedFallback: boolean;
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
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionImportDraftItem {
  id: string;
  type: QuestionType;
  stem: string;
  options: QuestionOption[];
  correctAnswers: string[];
  analysis: string | null;
  lawSource: string | null;
  sortOrder: number;
  sourceLabel: string | null;
  sourceContent: string | null;
  sourceRowNumbers: number[];
  isDeleted: boolean;
}

export interface QuestionImportSourceRowItem {
  id: string;
  rowNumber: number;
  status: QuestionImportSourceStatus;
  content: string;
  reason: string | null;
  matchedSortOrders: number[];
}

export interface QuestionImportSchemaSummary {
  headerRowCount: number;
  questionTypeColumn: number | null;
  stemColumn: number | null;
  optionColumns: number[];
  answerColumn: number | null;
  analysisColumn: number | null;
  lawSourceColumn: number | null;
  ignoredColumns: number[];
  answerEncoding: string | null;
}

export interface QuestionImportBatchDetail {
  id: string;
  bankId: string;
  fileName: string;
  sourceSheetName: string | null;
  templateType: QuestionImportTemplateType | null;
  status: QuestionImportBatchStatus;
  schemaMode: string | null;
  schemaSummary: QuestionImportSchemaSummary | null;
  draftCount: number;
  draftTotal: number;
  totalSourceRows: number;
  processedSourceRows: number;
  totalChunks: number;
  processedChunks: number;
  currentConcurrency: number;
  lastError: string | null;
  createdAt: string;
  parsedAt: string | null;
  confirmedAt: string | null;
  drafts: QuestionImportDraftItem[];
  sourceRowTotal: number;
  sourceRows: QuestionImportSourceRowItem[];
}

export interface QuestionImportBatchSummary {
  id: string;
  fileName: string;
  sourceSheetName: string | null;
  templateType: QuestionImportTemplateType | null;
  status: QuestionImportBatchStatus;
  schemaMode: string | null;
  schemaSummary: QuestionImportSchemaSummary | null;
  draftCount: number;
  totalSourceRows: number;
  processedSourceRows: number;
  totalChunks: number;
  processedChunks: number;
  currentConcurrency: number;
  lastError: string | null;
  createdAt: string;
  parsedAt: string | null;
  confirmedAt: string | null;
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
