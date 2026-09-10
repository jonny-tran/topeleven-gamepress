import { QueryCache, QueryClient } from "@tanstack/react-query";
import type { AppRouter } from "@topEleven-gamepress/api/routers/index";
import { env } from "@topEleven-gamepress/env/web";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";
import { observable, tap } from "@trpc/server/observable";

/**
 * Standard envelope returned by every server procedure.
 * Mirrors the shape produced by the responseEnvelopeMiddleware on the server.
 */
export interface ApiEnvelope<T> {
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
  noChange?: boolean;
}

function getServerUrl(url: string) {
  const processEnv = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  if (typeof window === "undefined" && processEnv?.SERVER_URL) {
    return processEnv.SERVER_URL.endsWith("/")
      ? processEnv.SERVER_URL.slice(0, -1)
      : processEnv.SERVER_URL;
  }

  const normalized = url.endsWith("/") ? url.slice(0, -1) : url;

  if (!normalized.startsWith("/")) {
    return normalized;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}${normalized}`;
  }

  const vercelUrl =
    processEnv?.VERCEL_ENV === "production"
      ? (processEnv?.VERCEL_PROJECT_PRODUCTION_URL ?? processEnv?.VERCEL_URL)
      : (processEnv?.VERCEL_URL ?? processEnv?.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercelUrl) {
    const origin = vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
    return `${origin}${normalized}`;
  }

  return `http://localhost:3000${normalized}`;
}

/**
 * Decide if a value looks like our API envelope:
 *   { statusCode, message, data, timestamp, path }
 */
function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.statusCode === "number" &&
    typeof v.message === "string" &&
    "data" in v &&
    typeof v.timestamp === "string" &&
    typeof v.path === "string"
  );
}

/**
 * Walk a tRPC response value and unwrap every envelope in place.
 * For success: replace `{ result: { data: { statusCode, message, data, ... } } }`
 *              with `{ result: { data: <inner_data> } }`
 * For error:   lift the business `message` to the top-level `message` field so
 *              TRPCClientError.message reflects our Vietnamese error description.
 *
 * tRPC success:  { result: { data: <envelope | raw> } }
 * tRPC error:    { error: { data: { message, ... }, message?: "..." } }
 */
function unwrapValue(value: unknown): void {
  if (!value || typeof value !== "object") return;

  // Batch: array of single-call results.
  if (Array.isArray(value)) {
    for (const item of value) unwrapValue(item);
    return;
  }

  const obj = value as Record<string, unknown>;

  if ("result" in obj && obj.result && typeof obj.result === "object") {
    const result = obj.result as Record<string, unknown>;
    if ("data" in result && isEnvelope(result.data)) {
      result.data = (result.data as ApiEnvelope<unknown>).data;
    }
    return;
  }

  if ("error" in obj && obj.error && typeof obj.error === "object") {
    const errorObj = obj.error as Record<string, unknown>;
    if (errorObj.data && typeof errorObj.data === "object") {
      const data = errorObj.data as Record<string, unknown>;
      if (typeof data.message === "string" && !errorObj.message) {
        errorObj.message = data.message;
      }
    }
  }
}

/**
 * Custom tRPC link that unwraps every server envelope BEFORE react-query
 * sees the response. Placed BEFORE httpBatchLink in the link chain so it
 * runs on the resolved observable values.
 *
 * The pattern follows tRPC's own loggerLink:
 *   () => ({ op, next }) => observable((observer) => next(op).pipe(tap({...})).subscribe(observer))
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrapEnvelopeLink(): any {
  return () => {
    return ({ op, next }: { op: unknown; next: (op: unknown) => ReturnType<typeof observable> }) => {
      return observable((observer) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (next(op) as any)
          .pipe(
            tap({
              next(value: unknown) {
                unwrapValue(value);
              },
              error(err: unknown) {
                unwrapValue(err);
              },
            })
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .subscribe(observer as any);
      });
    };
  };
}

/**
 * Build a helpful default toast message from a TRPCClientError. Prefer the
 * server-supplied `message`; fall back to the raw TRPC message; finally fall
 * back to a generic string.
 */
function messageFromError(err: unknown): string {
  if (err instanceof TRPCClientError) {
    if (err.message) return err.message;
  }
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Đã xảy ra lỗi không xác định.";
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      toast.error(messageFromError(error), {
        action: {
          label: "Thử lại",
          onClick: () => {
            query.invalidate();
          },
        },
      });
    },
  }),
});

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    // Unwrap server envelope before react-query sees the data.
    unwrapEnvelopeLink(),
    httpBatchLink({
      url: `${getServerUrl(env.NEXT_PUBLIC_SERVER_URL)}/trpc`,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});

export { trpcClient };

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});

/**
 * Safely extract a user-facing error message from a TRPCClientError (or any
 * thrown value). Prefers the server-supplied envelope message so users see
 * Vietnamese descriptions instead of raw stack info.
 */
export function getErrorMessage(err: unknown): string {
  return messageFromError(err);
}

/**
 * Walk a tRPC response value (single or batched) and, for each envelope
 * encountered under `result.data`, replace it with the inner `data` payload.
 *
 * For tRPC mutations the standard `onSuccess` handler already receives the
 * unwrapped `data` payload (via our custom link). This helper is primarily for
 * direct API calls / tests where the full envelope needs to be read.
 */
export function unwrapTRPCResponse<T = unknown>(value: T): T {
  if (!value || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      (value as unknown as unknown[])[i] = unwrapTRPCResponse(value[i]);
    }
    return value;
  }

  const obj = value as Record<string, unknown>;

  if ("result" in obj && obj.result && typeof obj.result === "object") {
    const result = obj.result as Record<string, unknown>;
    if ("data" in result && isEnvelope(result.data)) {
      result.data = (result.data as ApiEnvelope<unknown>).data;
    }
    return obj as T;
  }

  if ("error" in obj && obj.error && typeof obj.error === "object") {
    const errorObj = obj.error as Record<string, unknown>;
    if (errorObj.data && typeof errorObj.data === "object") {
      const data = errorObj.data as Record<string, unknown>;
      if (typeof data.message === "string" && !errorObj.message) {
        errorObj.message = data.message;
      }
    }
  }

  return value;
}

/**
 * Show a success or "no-change" toast. Call from a custom fetch wrapper or
 * from any place that receives a raw envelope object.
 */
export function showMutationToast<T>(
  result: ApiEnvelope<T> | undefined,
  options?: {
    noChangeMessage?: string;
    successMessage?: string;
  }
): boolean {
  if (!result) return false;
  if (result.noChange) {
    toast.info(options?.noChangeMessage ?? result.message ?? "Không có thay đổi nào.");
    return true;
  }
  toast.success(options?.successMessage ?? result.message ?? "Thao tác thành công.");
  return true;
}
