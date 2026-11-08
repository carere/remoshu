import { SELF } from "cloudflare:test";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

const authorization = {
  authorization: "Bearer test-cache-token",
};

const actionDigest = "a".repeat(64);
const blobDigest = "b".repeat(64);

describe("moon HTTP remote cache", () => {
  it.effect("round-trips an opaque Action Cache result", () =>
    Effect.gen(function* () {
      const url = `https://remoshu.test/moon-outputs/ac/${actionDigest}`;
      const actionResult = JSON.stringify({
        exitCode: 0,
        outputFiles: [],
        outputDirectories: [],
      });

      const upload = yield* Effect.promise(() =>
        SELF.fetch(url, {
          method: "PUT",
          headers: {
            ...authorization,
            "content-type": "application/json",
          },
          body: actionResult,
        }),
      );

      expect(upload.status).toBe(204);

      const download = yield* Effect.promise(() =>
        SELF.fetch(url, {
          headers: authorization,
        }),
      );

      expect(download.status).toBe(200);
      expect(download.headers.get("content-type")).toBe("application/json");
      expect(yield* Effect.promise(() => download.text())).toBe(actionResult);
    }),
  );

  it.effect("round-trips an opaque Content Addressable Storage blob", () =>
    Effect.gen(function* () {
      const url = `https://remoshu.test/company/project/cas/${blobDigest}`;
      const blob = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);

      const upload = yield* Effect.promise(() =>
        SELF.fetch(url, {
          method: "PUT",
          headers: authorization,
          body: blob,
        }),
      );

      expect(upload.status).toBe(204);

      const download = yield* Effect.promise(() =>
        SELF.fetch(url, {
          headers: authorization,
        }),
      );

      expect(download.status).toBe(200);
      expect(download.headers.get("content-type")).toBe("application/octet-stream");
      expect(download.headers.get("content-length")).toBe(String(blob.byteLength));
      expect(download.headers.get("etag")).toMatch(/^".+"$/);
      expect(new Uint8Array(yield* Effect.promise(() => download.arrayBuffer()))).toEqual(blob);
    }),
  );

  it.effect("round-trips a zero-byte CAS blob", () =>
    Effect.gen(function* () {
      const url = `https://remoshu.test/moon-outputs/cas/${"0".repeat(64)}`;
      const upload = yield* Effect.promise(() =>
        SELF.fetch(url, {
          method: "PUT",
          headers: authorization,
          body: new Uint8Array(),
        }),
      );
      expect(upload.status).toBe(204);

      const download = yield* Effect.promise(() => SELF.fetch(url, { headers: authorization }));
      expect(download.status).toBe(200);
      expect((yield* Effect.promise(() => download.arrayBuffer())).byteLength).toBe(0);
    }),
  );

  it.effect("returns not found for a missing valid cache object", () =>
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        SELF.fetch(`https://remoshu.test/moon-outputs/ac/${"f".repeat(64)}`, {
          headers: authorization,
        }),
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(yield* Effect.promise(() => response.json())).toEqual({ error: "not_found" });
    }),
  );

  it.effect("rejects uppercase digests", () =>
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        SELF.fetch(`https://remoshu.test/moon-outputs/cas/${"A".repeat(64)}`, {
          method: "PUT",
          headers: authorization,
          body: new Uint8Array([1]),
        }),
      );

      expect(response.status).toBe(400);
      expect(yield* Effect.promise(() => response.json())).toEqual({
        error: "invalid_cache_path",
      });
    }),
  );

  it.effect("returns not found outside the moon cache surface", () =>
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        SELF.fetch("https://remoshu.test/not-a-cache-route", {
          headers: authorization,
        }),
      );

      expect(response.status).toBe(404);
      expect(yield* Effect.promise(() => response.json())).toEqual({ error: "not_found" });
    }),
  );

  it.effect("rejects ambiguous encoded instance paths", () =>
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        SELF.fetch(`https://remoshu.test/company%2Fproject/ac/${"c".repeat(64)}`, {
          method: "PUT",
          headers: authorization,
          body: "{}",
        }),
      );

      expect(response.status).toBe(400);
      expect(yield* Effect.promise(() => response.json())).toEqual({
        error: "invalid_cache_path",
      });
    }),
  );

  it.effect("rejects unsupported methods on a valid cache route", () =>
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        SELF.fetch(`https://remoshu.test/moon-outputs/ac/${"d".repeat(64)}`, {
          method: "POST",
          headers: authorization,
        }),
      );

      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, PUT");
      expect(yield* Effect.promise(() => response.json())).toEqual({
        error: "method_not_allowed",
      });
    }),
  );
});
