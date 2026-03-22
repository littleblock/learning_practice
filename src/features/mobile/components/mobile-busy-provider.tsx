"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { stripAppBasePath } from "@/shared/utils/app-path";

const defaultBusyTitle = "页面处理中";
const defaultBusyDescription = "系统正在同步最新内容，请稍候。";
const minimumBusyDurationMs = 180;

interface MobileBusyRequest {
  id: number;
  title: string;
  description: string;
  keepUntilPathChange: boolean;
  startedAt: number;
}

interface StartBusyInput {
  title?: string;
  description?: string;
  keepUntilPathChange?: boolean;
}

interface MobileBusyHandle {
  clear: () => void;
}

interface MobileBusyContextValue {
  isBusy: boolean;
  startBusy: (input?: StartBusyInput) => MobileBusyHandle;
}

const MobileBusyContext = createContext<MobileBusyContextValue | null>(null);

function buildRequest(
  id: number,
  input?: StartBusyInput,
): MobileBusyRequest {
  return {
    id,
    title: input?.title?.trim() || defaultBusyTitle,
    description: input?.description?.trim() || defaultBusyDescription,
    keepUntilPathChange: input?.keepUntilPathChange ?? false,
    startedAt: Date.now(),
  };
}

export function MobileBusyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const routePath = stripAppBasePath(pathname);
  const currentRouteRef = useRef(routePath);
  const requestIdRef = useRef(0);
  const requestsRef = useRef<MobileBusyRequest[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const [requests, setRequests] = useState<MobileBusyRequest[]>([]);

  const removeRequest = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    requestsRef.current = requestsRef.current.filter((item) => item.id !== id);
    setRequests(requestsRef.current);
  }, []);

  const scheduleRemove = useCallback(
    (request: MobileBusyRequest) => {
      const elapsedMs = Date.now() - request.startedAt;
      const waitMs = Math.max(0, minimumBusyDurationMs - elapsedMs);
      if (waitMs <= 0) {
        removeRequest(request.id);
        return;
      }

      const timer = setTimeout(() => {
        removeRequest(request.id);
      }, waitMs);
      timersRef.current.set(request.id, timer);
    },
    [removeRequest],
  );

  const startBusy = useCallback(
    (input?: StartBusyInput) => {
      const nextRequest = buildRequest(++requestIdRef.current, input);
      requestsRef.current = [...requestsRef.current, nextRequest];
      setRequests(requestsRef.current);

      return {
        clear: () => {
          const currentRequest = requestsRef.current.find(
            (item) => item.id === nextRequest.id,
          );
          if (!currentRequest) {
            return;
          }

          scheduleRemove(currentRequest);
        },
      } satisfies MobileBusyHandle;
    },
    [scheduleRemove],
  );

  useEffect(() => {
    if (currentRouteRef.current === routePath) {
      return;
    }

    currentRouteRef.current = routePath;
    const pendingRouteRequests = requestsRef.current.filter(
      (item) => item.keepUntilPathChange,
    );
    pendingRouteRequests.forEach((item) => {
      scheduleRemove(item);
    });
  }, [routePath, scheduleRemove]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      isBusy: requests.length > 0,
      startBusy,
    }),
    [requests.length, startBusy],
  );
  const currentRequest = requests[requests.length - 1] ?? null;

  return (
    <MobileBusyContext.Provider value={value}>
      {children}
      {currentRequest ? (
        <div
          className="mobile-global-busy-mask"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="mobile-global-busy-panel">
            <span className="mobile-global-busy-spinner" aria-hidden="true" />
            <div className="mobile-global-busy-copy">
              <strong>{currentRequest.title}</strong>
              <p>{currentRequest.description}</p>
            </div>
          </div>
        </div>
      ) : null}
    </MobileBusyContext.Provider>
  );
}

export function useMobileBusy() {
  const context = useContext(MobileBusyContext);
  if (!context) {
    throw new Error("useMobileBusy 必须在 MobileBusyProvider 内使用");
  }

  return context;
}

export function useMobileBusyNavigation() {
  const router = useRouter();
  const { startBusy } = useMobileBusy();

  return useMemo(
    () => ({
      push: (href: string, input?: Omit<StartBusyInput, "keepUntilPathChange">) => {
        startBusy({
          ...input,
          keepUntilPathChange: true,
        });
        router.push(href);
      },
      replace: (
        href: string,
        input?: Omit<StartBusyInput, "keepUntilPathChange">,
      ) => {
        startBusy({
          ...input,
          keepUntilPathChange: true,
        });
        router.replace(href);
      },
    }),
    [router, startBusy],
  );
}
