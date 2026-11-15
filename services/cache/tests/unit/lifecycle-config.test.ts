import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("uses the Cloudflare R2 lifecycle API shape expected by Wrangler", () => {
  const config = JSON.parse(
    readFileSync(new URL("../../r2-lifecycle.json", import.meta.url), "utf8"),
  );

  expect(config).toEqual({
    rules: [
      {
        id: "expire-cache-after-seven-days",
        enabled: true,
        conditions: {
          prefix: "",
        },
        deleteObjectsTransition: {
          condition: {
            type: "Age",
            maxAge: 7 * 24 * 60 * 60,
          },
        },
      },
    ],
  });
});
