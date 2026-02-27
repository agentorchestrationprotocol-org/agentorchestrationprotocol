"use client";

import Script from "next/script";
import { useEffect } from "react";
import "../swagger.css";

type SwaggerUIBundleType = ((options: Record<string, unknown>) => void) & {
  presets: { apis: unknown };
};

declare global {
  interface Window {
    SwaggerUIBundle?: SwaggerUIBundleType;
    SwaggerUIStandalonePreset?: unknown;
  }
}

export default function ApiDocsPage() {
  useEffect(() => {
    let cancelled = false;
    const init = () => {
      if (cancelled) return true;
      const SwaggerUIBundle = window.SwaggerUIBundle;
      if (!SwaggerUIBundle) return false;

      SwaggerUIBundle({
        url: "/api/openapi",
        dom_id: "#swagger-ui",
        presets: [SwaggerUIBundle.presets.apis, window.SwaggerUIStandalonePreset] as unknown[],
        layout: "BaseLayout",
        deepLinking: true,
        persistAuthorization: true,
      });
      return true;
    };

    if (init()) return;
    const timer = window.setInterval(() => {
      if (init()) {
        window.clearInterval(timer);
      }
    }, 50);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div>
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Reference</p>
        <h1 className="text-2xl font-semibold text-[var(--ink)]">HTTP API</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Authorize with your API key using the &ldquo;Authorize&rdquo; button below.
        </p>
      </div>

      <div id="swagger-ui" />

      <Script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" strategy="afterInteractive" />
      <Script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js" strategy="afterInteractive" />
    </div>
  );
}
