function formatDuration(valueMs: number) {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h${minutes}min${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}min${seconds}s`;
  }

  return `${seconds}s`;
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN");
}

export function formatDurationBetween(
  startValue: string | null,
  endValue: string | null,
) {
  if (!startValue) {
    return "-";
  }

  const startTime = new Date(startValue).getTime();
  const endTime = endValue ? new Date(endValue).getTime() : Date.now();

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return "-";
  }

  return formatDuration(Math.max(0, endTime - startTime));
}

export function joinOptions(
  options: Array<{
    label: string;
    text: string;
  }>,
) {
  return options.map((item) => `${item.label}. ${item.text}`).join(" / ");
}

export function truncateText(value: string | null, length: number) {
  if (!value) {
    return "-";
  }

  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length)}...`;
}

const BATCH_STATUS_LABELS: Record<string, string> = {
  PENDING: "等待处理",
  PROCESSING: "解析中",
  READY: "待确认",
  CONFIRMED: "已导入",
  CANCELLED: "已终止",
  FAILED: "解析失败",
};

export function getBatchStatusLabel(status: string) {
  return BATCH_STATUS_LABELS[status] ?? status;
}

const IMPORT_TEMPLATE_TYPE_LABELS: Record<string, string> = {
  STANDARD: "标准模板",
  AI: "AI 识别",
};

export function getImportTemplateTypeLabel(type: string | null) {
  if (!type) {
    return "未记录";
  }

  return IMPORT_TEMPLATE_TYPE_LABELS[type] ?? type;
}

const IMPORT_SOURCE_STATUS_LABELS: Record<string, string> = {
  HEADER: "模板表头",
  MATCHED: "可纳入题目",
  FAILED: "匹配失败",
};

export function getImportSourceStatusLabel(status: string) {
  return IMPORT_SOURCE_STATUS_LABELS[status] ?? status;
}

const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "等待处理",
  PROCESSING: "处理中",
  READY: "可用",
  FAILED: "处理失败",
};

export function getDocumentStatusLabel(status: string) {
  return DOCUMENT_STATUS_LABELS[status] ?? status;
}
