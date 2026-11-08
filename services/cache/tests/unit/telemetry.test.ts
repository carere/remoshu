import { expect, it } from "vitest";
import { buildHttpRequestEvent } from "../../src/telemetry";

it("builds one safe cache request event with deep diagnostic fields", () => {
  const event = buildHttpRequestEvent({
    request: new Request(
      "https://cache.example.com/moon/outputs/cas/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      {
        method: "PUT",
        headers: {
          authorization: "Bearer never-log-me",
          "content-length": "3",
          "x-unrelated-secret": "also-never-log-me",
        },
      },
    ),
    response: new Response(null, { status: 204 }),
    startedAt: 10,
    finishedAt: 12.345,
    requestId: "request-id",
    traceId: "trace-id",
    spanId: "span-id",
    colo: "CDG",
    workerVersion: "version-id",
  });

  expect(event).toEqual({
    event: "http.request",
    request: {
      id: "request-id",
      method: "PUT",
      route: "/:instance/cas/:digest",
    },
    response: {
      status: 204,
      durationMs: 2.35,
    },
    auth: { outcome: "accepted" },
    cache: {
      instance: "moon/outputs",
      kind: "cas",
      digest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      outcome: "stored",
      size: 3,
    },
    cloudflare: {
      colo: "CDG",
      workerVersion: "version-id",
    },
    trace: {
      traceId: "trace-id",
      spanId: "span-id",
    },
  });
  expect(JSON.stringify(event)).not.toContain("never-log-me");
  expect(JSON.stringify(event)).not.toContain("also-never-log-me");
});
