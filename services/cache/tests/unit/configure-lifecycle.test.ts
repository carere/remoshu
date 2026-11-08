import { describe, expect, it } from "vitest";
import { resolveCacheBucketName } from "../../scripts/configure-lifecycle";

describe("lifecycle bucket resolution", () => {
  it("uses the bucket selected for the CACHE_BUCKET binding", () => {
    expect(
      resolveCacheBucketName({
        r2_buckets: [
          { binding: "OTHER_BUCKET", bucket_name: "other" },
          { binding: "CACHE_BUCKET", bucket_name: "custom-cache-name" },
        ],
      }),
    ).toBe("custom-cache-name");
  });

  it("fails clearly when the binding has no deployable bucket name", () => {
    expect(() => resolveCacheBucketName({ r2_buckets: [{ binding: "CACHE_BUCKET" }] })).toThrow(
      "CACHE_BUCKET must define a bucket_name",
    );
  });
});
