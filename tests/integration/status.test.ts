import { SELF } from "cloudflare:test";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

describe("remote cache status", () => {
  it.effect("reports ready when the bearer token is valid", () =>
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        SELF.fetch("https://remoshu.test/status", {
          headers: {
            authorization: "Bearer test-cache-token",
          },
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(yield* Effect.promise(() => response.json())).toEqual({ status: "ok" });
    }),
  );

  it.effect("rejects a request without a bearer token", () =>
    Effect.gen(function* () {
      const response = yield* Effect.promise(() => SELF.fetch("https://remoshu.test/status"));

      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(yield* Effect.promise(() => response.json())).toEqual({
        error: "unauthorized",
      });
    }),
  );

  it.effect("rejects an incorrect bearer token", () =>
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        SELF.fetch("https://remoshu.test/status", {
          headers: { authorization: "Bearer incorrect-token" },
        }),
      );

      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toBe("Bearer");
    }),
  );
});
