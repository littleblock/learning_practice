import { getServerEnv } from "@/server/env";

export interface AiSplitConcurrencyState {
  currentConcurrency: number;
  successStreak: number;
  cooldownUntil: number;
}

type Awaitable<T> = T | Promise<T>;

export interface AiSplitConcurrencyObserver {
  onStateChange?: (state: AiSplitConcurrencyState) => Awaitable<void>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 功能说明：
 * 维护 AI 拆题任务的自适应并发窗口。
 *
 * 业务背景：
 * 不同模型供应商在不同时间段的并发限制不稳定，固定并发值容易在高峰时触发限流，
 * 也会在低峰时浪费可用吞吐。
 *
 * 核心逻辑：
 * 控制器在限流时立即降并发并进入冷却期，在连续成功达到阈值后逐步回升，
 * 从而在成功率和吞吐量之间自动寻找平衡点。
 *
 * 关键约束：
 * 冷却期结束后必须允许重新升并发，不能把临时限流误判为永久上限。
 */
export class AiSplitConcurrencyController {
  private readonly minConcurrency: number;

  private readonly maxConcurrency: number;

  private readonly scaleUpSuccessThreshold: number;

  private readonly rateLimitCooldownMs: number;

  private currentConcurrency: number;

  private successStreak = 0;

  private cooldownUntil = 0;

  constructor() {
    const env = getServerEnv();
    this.minConcurrency = env.AI_SPLIT_CONCURRENCY_MIN;
    this.maxConcurrency = Math.max(
      env.AI_SPLIT_CONCURRENCY_MIN,
      env.AI_SPLIT_CONCURRENCY_MAX,
    );
    this.scaleUpSuccessThreshold = env.AI_SPLIT_SCALE_UP_SUCCESS_THRESHOLD;
    this.rateLimitCooldownMs = env.AI_SPLIT_RATE_LIMIT_COOLDOWN_MS;
    this.currentConcurrency = Math.min(
      Math.max(env.AI_SPLIT_CONCURRENCY_INITIAL, this.minConcurrency),
      this.maxConcurrency,
    );
  }

  getLimit() {
    return this.currentConcurrency;
  }

  getState(): AiSplitConcurrencyState {
    return {
      currentConcurrency: this.currentConcurrency,
      successStreak: this.successStreak,
      cooldownUntil: this.cooldownUntil,
    };
  }

  async recordSuccess(observer?: AiSplitConcurrencyObserver) {
    this.successStreak += 1;

    if (Date.now() < this.cooldownUntil) {
      await observer?.onStateChange?.(this.getState());
      return;
    }

    if (
      this.currentConcurrency < this.maxConcurrency &&
      this.successStreak >= this.scaleUpSuccessThreshold
    ) {
      this.currentConcurrency += 1;
      this.successStreak = 0;
    }

    await observer?.onStateChange?.(this.getState());
  }

  async recordRateLimit(observer?: AiSplitConcurrencyObserver) {
    this.currentConcurrency = Math.max(
      this.minConcurrency,
      Math.ceil(this.currentConcurrency / 2),
    );
    this.successStreak = 0;
    this.cooldownUntil = Date.now() + this.rateLimitCooldownMs;
    await observer?.onStateChange?.(this.getState());
  }

  async waitForCooldown() {
    const waitMs = this.cooldownUntil - Date.now();
    if (waitMs > 0) {
      await delay(waitMs);
    }
  }
}

export async function mapWithAdaptiveConcurrency<TItem, TResult>(
  items: TItem[],
  controller: AiSplitConcurrencyController,
  worker: (item: TItem, index: number) => Promise<TResult>,
) {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;
  let inFlight = 0;

  return await new Promise<TResult[]>((resolve, reject) => {
    const launchNext = () => {
      if (nextIndex >= items.length && inFlight === 0) {
        resolve(results);
        return;
      }

      while (inFlight < controller.getLimit() && nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        inFlight += 1;

        void worker(items[currentIndex], currentIndex)
          .then((result) => {
            results[currentIndex] = result;
            inFlight -= 1;
            launchNext();
          })
          .catch((error) => {
            reject(error);
          });
      }
    };

    launchNext();
  });
}
