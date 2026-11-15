import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";
import { CacheStorageError, CacheStore } from "./cache-store";

type WorkerEnv = Cloudflare.Env & {
  readonly CACHE_BUCKET: R2Bucket;
};

const bucket = (): R2Bucket => (env as WorkerEnv).CACHE_BUCKET;

export const R2CacheStoreLive = Layer.succeed(CacheStore, {
  get: (key) =>
    Effect.tryPromise({
      try: () => bucket().get(key),
      catch: (cause) => new CacheStorageError({ cause, operation: "get" }),
    }).pipe(
      Effect.map((object) =>
        object === null
          ? undefined
          : {
              body: object.body,
              etag: object.httpEtag,
              size: object.size,
            },
      ),
    ),
  put: (key, body) =>
    Effect.tryPromise({
      try: () => bucket().put(key, body),
      catch: (cause) => new CacheStorageError({ cause, operation: "put" }),
    }).pipe(Effect.asVoid),
});
