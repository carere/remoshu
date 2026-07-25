import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
      miniflare: {
        bindings: {
          CACHE_TOKEN: "test-cache-token",
        },
      },
    }),
  ],
  test: {
    name: "integration",
    include: ["tests/integration/**/*.test.ts"],
  },
});
