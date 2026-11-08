# Cloudflare deployment

Remoshu has two independent Cloudflare Workers. The public website is a static-assets Worker at
`remoshu.carere.dev`. The cache is an authenticated Worker with an R2 binding. Deploying the website
does not deploy or reconfigure the cache.

## Website: Workers Builds

Create a Worker named **remoshu-website**, connect `carere/remoshu` using Cloudflare's Git integration,
and select these settings under **Settings → Build**:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `/` (repository root) |
| Build command | `bun install --frozen-lockfile && bunx moon run website:build` |
| Deploy command | `bun run --cwd apps/website deploy` |
| Non-production branch deploy command | `bun run --cwd apps/website upload` |
| Build variable | `BUN_VERSION=1.4.2` |
| Build variable | `NODE_VERSION=24.21.0` |

Keep the root at the repository root so Bun sees the workspaces and the shared lockfile. Wrangler
uploads `apps/website/dist` as static assets; no application Worker script, runtime secrets, or R2
bindings are needed. The deploy command must run after the build command. For manual deployment,
`bun run deploy:website` runs the build dependency through Moon before deploying.

Set the build watch paths to:

```text
apps/website/**
.moon/**
.prototools
package.json
bun.lock
```

Cloudflare's exact settings are documented in
[Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
and [build watch paths](https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/).

### Custom domain

The tracked `apps/website/wrangler.jsonc` declares `remoshu.carere.dev` as a Worker custom domain.
Deploy from the Cloudflare account that owns the active `carere.dev` zone. Cloudflare manages the
domain's DNS record and certificate when the custom domain is attached. Remove conflicting DNS
records for that hostname if Cloudflare reports a conflict.

The dashboard repository connection, build settings, and active domain/certificate state live in
Cloudflare; committing the Wrangler file alone does not create the Git integration. No deployment
credentials are stored in this repository. Workers Builds can supply its own deployment token.

## Existing cache: update after the monorepo migration

Keep the existing cache Worker's name, R2 binding, and `CACHE_TOKEN` secret. Its canonical Wrangler
configuration now lives at `services/cache/wrangler.jsonc`. Update its Workers Builds settings:

| Setting | Value |
| --- | --- |
| Root directory | `/` |
| Build command | `bun install --frozen-lockfile && bunx moon run cache:build` |
| Deploy command | `bun run --cwd services/cache deploy` |
| Build variables | `BUN_VERSION=1.4.2`, `NODE_VERSION=24.21.0` |

Watch `services/cache/**`, `.moon/**`, `.prototools`, `package.json`, and `bun.lock`. The deploy
script reapplies the R2 lifecycle rule, so its API token needs lifecycle permissions as before.
Do not run the cache's production deploy command for branch previews against the production bucket.

## Template deployments

The public Deploy to Cloudflare button points to `services/cache`, not the whole monorepo.
Cloudflare copies that directory into a new repository. It contains its own package manifest,
Wrangler config, secret example, source, lifecycle scripts, and TypeScript configuration, and can run
without Moon or the website. Its dependencies are pinned in the manifest; a standalone installation
creates its own lockfile. Use `bun install` for that initial installation.

This follows Cloudflare's
[deploy-button subdirectory contract](https://developers.cloudflare.com/workers/platform/deploy-buttons/).
