# Remoshu cache

A self-hosted HTTP remote cache for moon v2, using Cloudflare Workers and a private R2 bucket.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/carere/remoshu/tree/main/services/cache)

This directory is also a standalone template. Cloudflare can copy it into a new repository,
provision the R2 binding, prompt for `CACHE_TOKEN`, and run the deployment script. Keep the token
to configure moon clients afterward.

For a standalone manual installation, run `bun install`, authenticate with `bunx wrangler login`,
review `wrangler.jsonc`, then run:

```sh
bun run provision
bunx wrangler secret put CACHE_TOKEN
bun run deploy
```

For local development, copy `.dev.vars.example` to `.dev.vars`, set a development token, and run
`bun run dev`. `bun run test`, `bun run typecheck`, and `bun run build` validate the service.
`bun run test:e2e` also needs moon v2 on `PATH`.

Configure each moon workspace:

```yaml
remote:
  api: "http"
  host: "https://YOUR-WORKER.workers.dev"
  auth:
    token: "MOON_REMOTE_CACHE_TOKEN"
  cache:
    instanceName: "your-org/your-repo"
    verifyIntegrity: true
```

Set `MOON_REMOTE_CACHE_TOKEN` to the deployed Worker's `CACHE_TOKEN` in your local environment and
CI secrets. The single token grants access to all instances. Artifacts expire seven days after their
latest upload, with asynchronous lifecycle deletion. Storage, requests, and R2 operations may incur
Cloudflare charges; R2 has free internet egress.

Read the [full documentation](https://github.com/carere/remoshu#readme) or visit
[remoshu.carere.dev](https://remoshu.carere.dev).
