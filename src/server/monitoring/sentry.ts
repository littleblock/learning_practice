import { getServerEnv } from "@/server/env";

type SentryModule = typeof import("@sentry/nextjs");

let initialized = false;
let enabled = false;
let sentryModule: SentryModule | null = null;

function loadSentryModule() {
  if (sentryModule) {
    return sentryModule;
  }

  const runtimeRequire = Function("return require")() as NodeRequire;
  sentryModule = runtimeRequire("@sentry/nextjs") as SentryModule;
  return sentryModule;
}

function ensureSentryInitialized() {
  if (initialized) {
    return enabled;
  }

  const env = getServerEnv();
  enabled = env.ENABLE_SENTRY && Boolean(env.SENTRY_DSN);

  if (enabled) {
    const Sentry = loadSentryModule();

    Sentry.init({
      dsn: env.SENTRY_DSN,
      tracesSampleRate: 0,
    });
  }

  initialized = true;
  return enabled;
}

export function captureServerException(
  error: unknown,
  extra?: Record<string, unknown>,
) {
  if (!ensureSentryInitialized()) {
    return;
  }

  const Sentry = loadSentryModule();

  Sentry.withScope((scope) => {
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        scope.setExtra(key, value ?? null);
      }
    }

    Sentry.captureException(error);
  });
}
