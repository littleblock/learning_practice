export const BANK_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
export const BANK_CODE_PREFIX = "TK";
export const BANK_CODE_SEQUENCE_LENGTH = 8;
export const BANK_CODE_TIME_ZONE = "Asia/Shanghai";

/**
 * 功能说明：
 * 统一维护题库编码的校验与生成规则。
 *
 * 业务背景：
 * 题库编码是后台题库管理、题目导入和后续系统对接的稳定标识，需要同时支持历史人工编码校验与新题库自动编号。
 *
 * 核心逻辑：
 * 人工编码允许大小写字母、数字、下划线和中划线；自动编号固定为 TK-YYYYMM-XXXXXXXX，其中年月按上海时区计算。
 *
 * 关键约束：
 * 自动流水号固定为 8 位十进制数字，调用方需要自行保证同一月份内的唯一性。
 */
export function getBankCodePeriod(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: BANK_CODE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  if (!year || !month) {
    throw new Error("无法生成题库编码年月");
  }

  return `${year}${month.padStart(2, "0")}`;
}

export function getBankCodePrefix(period = getBankCodePeriod()) {
  return `${BANK_CODE_PREFIX}-${period}-`;
}

export function buildBankCode(period: string, sequence: number) {
  return `${getBankCodePrefix(period)}${sequence.toString().padStart(BANK_CODE_SEQUENCE_LENGTH, "0")}`;
}

export function extractBankCodeSequence(code: string, period: string) {
  const prefix = getBankCodePrefix(period);

  if (!code.startsWith(prefix)) {
    return null;
  }

  const sequence = Number.parseInt(code.slice(prefix.length), 10);
  return Number.isSafeInteger(sequence) ? sequence : null;
}
