import { env } from "cloudflare:workers";
import { Effect, Logger } from "effect";
import { HttpMiddleware, HttpServerRequest } from "effect/unstable/http";
import { buildHttpRequestEvent } from "./telemetry";

type WorkerEnv = Cloudflare.Env & {
  readonly CF_VERSION_METADATA: WorkerVersionMetadata;
};

const JsonLoggerLive = Logger.layer([Logger.consoleJson]);

export const deepEventMiddleware = HttpMiddleware.make((httpEffect) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const source = request.source as Request;
    const startedAt = performance.now();
    const span = yield* Effect.currentSpan;
    const requestId = source.headers.get("cf-ray") ?? crypto.randomUUID();
    const workerVersion = (env as WorkerEnv).CF_VERSION_METADATA?.id;
    const colo = typeof source.cf?.colo === "string" ? source.cf.colo : undefined;

    const emit = (
      response: { readonly status: number; readonly headers: Readonly<Record<string, string>> },
      errorType?: string,
    ) =>
      Effect.logInfo(
        buildHttpRequestEvent({
          request: source,
          response,
          startedAt,
          finishedAt: performance.now(),
          requestId,
          traceId: span.traceId,
          spanId: span.spanId,
          colo,
          workerVersion,
          errorType,
        }),
      );

    return yield* Effect.matchCauseEffect(httpEffect, {
      onSuccess: (response) => emit(response).pipe(Effect.as(response)),
      onFailure: (cause) =>
        emit({ status: 500, headers: {} }, "unexpected_error").pipe(
          Effect.andThen(Effect.failCause(cause)),
        ),
    });
  }).pipe(Effect.withSpan("http.request"), Effect.provide(JsonLoggerLive)),
);
