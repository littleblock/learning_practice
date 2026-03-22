export const APP_NAME = "刷题小工具";

export const SESSION_COOKIE_NAME = "learning_practice_session";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const DEFAULT_PAGE_SIZE = 10;

export const MAX_PAGE_SIZE = 100;

export const MATCH_SCORE_THRESHOLD = 0.55;

export const CHUNK_SIZE = 600;

export const CHUNK_OVERLAP = 100;

export const WRONG_BOOK_RECOVERY_COUNT = 2;

export const EXCEL_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const STATUTE_MAX_SIZE_BYTES = 20 * 1024 * 1024;

export const SUPPORTED_EXCEL_EXTENSIONS = [".xlsx", ".xls", ".csv"];

export const SUPPORTED_STATUTE_EXTENSIONS = [".txt", ".md", ".docx", ".pdf"];

export const SUPPORTED_EXCEL_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
];

export const SUPPORTED_STATUTE_MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
