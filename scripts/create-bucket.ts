import { resolveCacheBucketName } from "./configure-lifecycle";

const config = Bun.JSONC.parse(await Bun.file("wrangler.jsonc").text());
const bucketName = resolveCacheBucketName(config);
const process = Bun.spawn(["bun", "x", "wrangler", "r2", "bucket", "create", bucketName], {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
const exitCode = await process.exited;
if (exitCode !== 0) {
  throw new Error(`Failed to create R2 bucket ${bucketName}`);
}
