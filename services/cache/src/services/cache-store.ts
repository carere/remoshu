import { Context, Data, Effect, Layer } from "effect";

export interface CacheObject {
  readonly body: ReadableStream<Uint8Array>;
  readonly etag: string;
  readonly size: number;
}

interface CacheStoreShape {
  readonly get: (key: string) => Effect.Effect<CacheObject | undefined, CacheStorageError>;
  readonly put: (
    key: string,
    body: ReadableStream<Uint8Array> | Uint8Array,
  ) => Effect.Effect<void, CacheStorageError>;
}

export class CacheStorageError extends Data.TaggedError("CacheStorageError")<{
  readonly cause: unknown;
  readonly operation: "get" | "put";
}> {}

export class CacheStore extends Context.Service<CacheStore, CacheStoreShape>()(
  "remoshu/CacheStore",
) {}

export const makeInMemoryCacheStoreLayer = () => {
  const objects = new Map<string, { readonly bytes: Uint8Array; readonly etag: string }>();
  let revision = 0;

  return Layer.succeed(CacheStore, {
    get: (key) =>
      Effect.sync(() => {
        const object = objects.get(key);
        if (object === undefined) {
          return undefined;
        }

        return {
          body: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(object.bytes);
              controller.close();
            },
          }),
          etag: object.etag,
          size: object.bytes.byteLength,
        };
      }),
    put: (key, body) =>
      Effect.tryPromise({
        try: async () => {
          const bytes =
            body instanceof Uint8Array
              ? body.slice()
              : new Uint8Array(await new Response(body).arrayBuffer());
          revision += 1;
          objects.set(key, { bytes, etag: `"in-memory-${revision}"` });
        },
        catch: (cause) => new CacheStorageError({ cause, operation: "put" }),
      }),
  });
};
