import path from "node:path";

import {
  SUPPORTED_EXCEL_MIME_TYPES,
  SUPPORTED_EXCEL_EXTENSIONS,
  SUPPORTED_STATUTE_MIME_TYPES,
  SUPPORTED_STATUTE_EXTENSIONS,
} from "@/shared/constants/app";

export function getFileExtension(fileName: string) {
  return path.extname(fileName).toLowerCase();
}

export function isAllowedExcelFile(fileName: string) {
  return SUPPORTED_EXCEL_EXTENSIONS.includes(getFileExtension(fileName));
}

export function isAllowedStatuteFile(fileName: string) {
  return SUPPORTED_STATUTE_EXTENSIONS.includes(getFileExtension(fileName));
}

function normalizeMimeType(mimeType: string) {
  return mimeType.trim().toLowerCase();
}

function isAllowedMimeType(mimeType: string, supportedTypes: string[]) {
  if (!mimeType.trim()) {
    return true;
  }

  return supportedTypes.includes(normalizeMimeType(mimeType));
}

export function isAllowedExcelMimeType(mimeType: string) {
  return isAllowedMimeType(mimeType, SUPPORTED_EXCEL_MIME_TYPES);
}

export function isAllowedStatuteMimeType(mimeType: string) {
  return isAllowedMimeType(mimeType, SUPPORTED_STATUTE_MIME_TYPES);
}
