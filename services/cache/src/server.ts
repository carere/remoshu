import { Effect, Layer } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { RemoshuApi } from "./api";
import { BearerAuthLive } from "./auth";
import { parseCachePath } from "./cache-path";
import { deepEventMiddleware } from "./cloudflare-telemetry";
import { CacheStore } from "./services/cache-store";
import { R2CacheStoreLive } from "./services/r2-cache-store";
import { RuntimeConfigLive } from "./services/runtime-config";

const cacheControl = {
  "cache-control": "private, no-store",
};

const badRequest = HttpServerResponse.jsonUnsafe(
  { error: "invalid_cache_path" },
  {
    status: 400,
    headers: cacheControl,
  },
);

const notFound = HttpServerResponse.jsonUnsafe(
  { error: "not_found" },
  {
    status: 404,
    headers: cacheControl,
  },
);

const invalidPathResponse = (url: string) => {
  const pathname = new URL(url).pathname;
  return /\/(?:ac|cas)(?:\/|$)/.test(pathname) ? badRequest : notFound;
};

const methodNotAllowed = HttpServerResponse.jsonUnsafe(
  { error: "method_not_allowed" },
  {
    status: 405,
    headers: {
      ...cacheControl,
      allow: "GET, PUT",
    },
  },
);

const unsupportedMethod = ({ request }: { readonly request: { readonly originalUrl: string } }) =>
  Effect.succeed(
    parseCachePath(request.originalUrl) === undefined
      ? invalidPathResponse(request.originalUrl)
      : methodNotAllowed,
  );

const StatusLive = HttpApiBuilder.group(RemoshuApi, "status", (handlers) =>
  handlers.handle("status", () =>
    Effect.succeed(
      HttpServerResponse.jsonUnsafe(
        { status: "ok" },
        {
          headers: {
            "cache-control": "private, no-store",
          },
        },
      ),
    ),
  ),
);

const CacheLive = HttpApiBuilder.group(RemoshuApi, "cache", (handlers) =>
  handlers
    .handleRaw("putCache", ({ request }) =>
      Effect.gen(function* () {
        const path = parseCachePath(request.originalUrl);
        if (path === undefined) {
          return invalidPathResponse(request.originalUrl);
        }

        const store = yield* CacheStore;
        const body = (request.source as Request).body ?? new Uint8Array();
        yield* store.put(path.key, body);

        return HttpServerResponse.empty({
          status: 204,
          headers: cacheControl,
        });
      }).pipe(Effect.orDie),
    )
    .handleRaw("getCache", ({ request }) =>
      Effect.gen(function* () {
        const path = parseCachePath(request.originalUrl);
        if (path === undefined) {
          return invalidPathResponse(request.originalUrl);
        }

        const store = yield* CacheStore;
        const object = yield* store.get(path.key);
        if (object === undefined) {
          return notFound;
        }

        return HttpServerResponse.raw(object.body, {
          contentLength: object.size,
          contentType: path.kind === "ac" ? "application/json" : "application/octet-stream",
          headers: {
            ...cacheControl,
            etag: object.etag,
          },
        });
      }).pipe(Effect.orDie),
    )
    .handleRaw("postFallback", unsupportedMethod)
    .handleRaw("patchFallback", unsupportedMethod)
    .handleRaw("deleteFallback", unsupportedMethod)
    .handleRaw("headFallback", unsupportedMethod)
    .handleRaw("optionsFallback", unsupportedMethod),
);

const AuthLive = BearerAuthLive.pipe(Layer.provide(RuntimeConfigLive));
const CacheDependenciesLive = Layer.merge(AuthLive, R2CacheStoreLive);

const ApiLive = HttpApiBuilder.layer(RemoshuApi).pipe(
  Layer.provide([
    StatusLive.pipe(Layer.provide(AuthLive)),
    CacheLive.pipe(Layer.provide(CacheDependenciesLive)),
  ]),
  Layer.provide(HttpServer.layerServices),
);

export const webHandler = HttpRouter.toWebHandler(ApiLive, {
  disableLogger: true,
  middleware: deepEventMiddleware,
});
