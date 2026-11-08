import { Effect, Layer, Redacted } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi";
import { RuntimeConfig } from "./services/runtime-config";

const encoder = new TextEncoder();

interface CloudflareSubtleCrypto extends SubtleCrypto {
  timingSafeEqual(left: ArrayBufferView, right: ArrayBufferView): boolean;
}

const timingSafeEqual = (received: string, expected: string): boolean => {
  const receivedBytes = encoder.encode(received);
  const expectedBytes = encoder.encode(expected);
  const lengthsMatch = receivedBytes.byteLength === expectedBytes.byteLength;
  const subtle = crypto.subtle as CloudflareSubtleCrypto;

  return lengthsMatch
    ? subtle.timingSafeEqual(receivedBytes, expectedBytes)
    : !subtle.timingSafeEqual(receivedBytes, receivedBytes);
};

const unauthorized = HttpServerResponse.jsonUnsafe(
  { error: "unauthorized" },
  {
    status: 401,
    headers: {
      "cache-control": "private, no-store",
      "www-authenticate": "Bearer",
    },
  },
);

export class BearerAuth extends HttpApiMiddleware.Service<BearerAuth>()("remoshu/BearerAuth", {
  security: {
    bearer: HttpApiSecurity.bearer,
  },
}) {}

export const BearerAuthLive = Layer.effect(
  BearerAuth,
  Effect.gen(function* () {
    const config = yield* RuntimeConfig;

    return {
      bearer: (httpEffect, { credential }) =>
        timingSafeEqual(Redacted.value(credential), config.cacheToken())
          ? httpEffect
          : Effect.succeed(unauthorized),
    };
  }),
);
