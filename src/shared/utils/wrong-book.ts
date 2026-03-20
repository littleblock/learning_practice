export interface WrongBookStateInput {
  isInWrongBook: boolean;
  consecutiveCorrectInWrongBook: number;
}

export interface WrongBookStateResult {
  isInWrongBook: boolean;
  consecutiveCorrectInWrongBook: number;
}

/**
功能说明：
根据本次判题结果计算题目在错题本中的最新状态。

业务背景：
错题本是用户复习闭环的核心数据，系统需要在每次提交后统一维护“进入错题本”和“连续答对后移出”的规则。

核心逻辑：
答错时立即进入错题本并清零恢复计数；若题目已在错题本中，则累计连续答对次数，达到阈值后移出。

关键约束：
当前错题移出阈值固定为 2 次；不在错题本中的题目即便答对，也不会累计恢复计数。
*/
export function resolveWrongBookState(
  current: WrongBookStateInput | null,
  isCorrect: boolean,
  recoveryThreshold = 2,
): WrongBookStateResult {
  if (!current) {
    return {
      isInWrongBook: !isCorrect,
      consecutiveCorrectInWrongBook: 0,
    };
  }

  if (!isCorrect) {
    return {
      isInWrongBook: true,
      consecutiveCorrectInWrongBook: 0,
    };
  }

  if (!current.isInWrongBook) {
    return {
      isInWrongBook: false,
      consecutiveCorrectInWrongBook: 0,
    };
  }

  const nextRecoveryCount = current.consecutiveCorrectInWrongBook + 1;
  return {
    isInWrongBook: nextRecoveryCount < recoveryThreshold,
    consecutiveCorrectInWrongBook: nextRecoveryCount,
  };
}
