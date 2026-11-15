import { parseCachePath } from "./cache-path";

interface ResponseMetadata {
  readonly headers: Headers | Readonly<Record<string, string>>;
  readonly status: number;
}

interface BuildHttpRequestEventOptions {
  readonly colo?: string | undefined;
  readonly errorType?: string | undefined;
  readonly finishedAt: number;
  readonly request: Request;
  readonly requestId: string;
  readonly response: ResponseMetadata;
  readonly spanId: string;
  readonly startedAt: number;
  readonly traceId: string;
  readonly workerVersion?: string | undefined;
}

const header = (headers: ResponseMetadata["headers"], name: string): string | undefined => {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  return headers[name.toLowerCase()];
};

const cacheOutcome = (method: string, status: number): string => {
  if (status === 400) return "invalid";
  if (status === 401) return "unauthorized";
  if (status === 405) return "method_not_allowed";
  if (status >= 500) return "error";
  if (method === "PUT" && status === 204) return "stored";
  if (method === "GET" && status === 200) return "hit";
  if (method === "GET" && status === 404) return "miss";
  return "not_found";
};

export const buildHttpRequestEvent = (options: BuildHttpRequestEventOptions) => {
  const path = parseCachePath(options.request.url);
  const status = options.response.status;
  const responseSize = header(options.response.headers, "content-length");
  const requestSize = options.request.headers.get("content-length");
  const size = Number(responseSize ?? requestSize);

  return {
    event: "http.request" as const,
    request: {
      id: options.requestId,
      method: options.request.method,
      route:
        new URL(options.request.url).pathname === "/status"
          ? "/status"
          : path === undefined
            ? "unmatched"
            : `/:instance/${path.kind}/:digest`,
    },
    response: {
      status,
      durationMs: Math.round((options.finishedAt - options.startedAt) * 100) / 100,
    },
    auth: {
      outcome: status === 401 ? "denied" : "accepted",
    },
    ...(path === undefined
      ? {}
      : {
          cache: {
            instance: path.instance,
            kind: path.kind,
            digest: path.digest,
            outcome: cacheOutcome(options.request.method, status),
            ...(Number.isFinite(size) ? { size } : {}),
            ...(header(options.response.headers, "etag") === undefined
              ? {}
              : { etag: header(options.response.headers, "etag") }),
          },
        }),
    cloudflare: {
      ...(options.colo === undefined ? {} : { colo: options.colo }),
      ...(options.workerVersion === undefined ? {} : { workerVersion: options.workerVersion }),
    },
    trace: {
      traceId: options.traceId,
      spanId: options.spanId,
    },
    ...(options.errorType === undefined ? {} : { error: { type: options.errorType } }),
  };
};
