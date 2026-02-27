"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const MAX_EVENTS_PER_PAGE = 20;

const toMessage = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  return String(value ?? "Unknown error");
};

export default function FrontendErrorTracker() {
  const captureFrontendError = useMutation(api.observability.captureFrontendError);
  const sentCountRef = useRef(0);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const submit = (payload: {
      message: string;
      stack?: string;
      pageUrl?: string;
      userAgent?: string;
      errorCode?: string;
    }) => {
      const key = `${payload.errorCode ?? "error"}:${payload.message}:${payload.pageUrl ?? ""}`;
      if (seenRef.current.has(key)) return;
      if (sentCountRef.current >= MAX_EVENTS_PER_PAGE) return;
      seenRef.current.add(key);
      sentCountRef.current += 1;
      void captureFrontendError(payload).catch(() => {});
    };

    const onError = (event: ErrorEvent) => {
      submit({
        message: event.message || "Unhandled browser error",
        stack: typeof event.error?.stack === "string" ? event.error.stack : undefined,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
        errorCode: "window_error",
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const rejection = event.reason;
      submit({
        message: toMessage(rejection),
        stack: typeof rejection?.stack === "string" ? rejection.stack : undefined,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
        errorCode: "unhandled_rejection",
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [captureFrontendError]);

  return null;
}
