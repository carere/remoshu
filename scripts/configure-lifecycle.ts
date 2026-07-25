type JsonObject = Readonly<Record<string, unknown>>;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const resolveCacheBucketName = (config: unknown): string => {
  if (!isJsonObject(config) || !Array.isArray(config.r2_buckets)) {
    throw new Error("wrangler.jsonc must define an r2_buckets array");
  }

  const binding = config.r2_buckets.find(
    (candidate) => isJsonObject(candidate) && candidate.binding === "CACHE_BUCKET",
  );
  if (!isJsonObject(binding) || typeof binding.bucket_name !== "string") {
    throw new Error("CACHE_BUCKET must define a bucket_name");
  }

  const bucketName = binding.bucket_name.trim();
  if (bucketName === "") {
    throw new Error("CACHE_BUCKET must define a bucket_name");
  }
  return bucketName;
};

const configureLifecycle = async () => {
  const config = Bun.JSONC.parse(await Bun.file("wrangler.jsonc").text());
  const bucketName = resolveCacheBucketName(config);
  const process = Bun.spawn(
    [
      "bun",
      "x",
      "wrangler",
      "r2",
      "bucket",
      "lifecycle",
      "set",
      bucketName,
      "--file",
      "r2-lifecycle.json",
      "--force",
    ],
    {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  const exitCode = await process.exited;
  if (exitCode !== 0) {
    throw new Error(`Failed to configure the lifecycle for R2 bucket ${bucketName}`);
  }
};

if (import.meta.main) {
  await configureLifecycle();
}
