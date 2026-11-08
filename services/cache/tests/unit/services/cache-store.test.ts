import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { CacheStore, makeInMemoryCacheStoreLayer } from "../../../src/services/cache-store";

it.effect("the in-memory cache service overwrites and retrieves opaque bytes", () =>
  Effect.gen(function* () {
    const store = yield* CacheStore;
    const first = new Uint8Array([1, 2, 3]);
    const replacement = new Uint8Array([4, 5]);

    yield* store.put("moon-outputs/cas/digest", first);
    yield* store.put("moon-outputs/cas/digest", replacement);

    const object = yield* store.get("moon-outputs/cas/digest");
    expect(object?.size).toBe(2);
    expect(object?.etag).toBe('"in-memory-2"');
    expect(
      new Uint8Array(yield* Effect.promise(() => new Response(object?.body).arrayBuffer())),
    ).toEqual(replacement);
  }).pipe(Effect.provide(makeInMemoryCacheStoreLayer())),
);
