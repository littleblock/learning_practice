export function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN");
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
    return "-";
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
