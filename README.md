# Remoshu

<img src="apps/website/public/brand/remoshu-mark-v2.png" width="88" alt="Remoshu remote-cache logo" />

[Website](https://remoshu.carere.dev) · [Cloudflare build setup](docs/cloudflare.md) · [Brand](docs/brand.md)

A moon HTTP remote cache for Cloudflare Workers and R2.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/carere/remoshu/tree/main/services/cache)

Remoshu implements the small HTTP action-cache (AC) and content-addressable-storage (CAS)
surface used by moon v2. Cache objects are streamed through a Worker into a private R2 bucket,
authenticated with one bearer token, and expired after seven days by an R2 lifecycle rule.

The project is intentionally a GitHub template, not a hosted multi-tenant service. Create a
repository from the template, deploy it into the Cloudflare account of your choice, and point one
or more moon workspaces at it.

## One-click deployment

Select **Deploy to Cloudflare** above, then:

1. Authorize Cloudflare to create a repository in your GitHub account and select the destination
   Cloudflare account.
2. Choose the repository, Worker, and private R2 bucket names.
3. Enter a long random value for `CACHE_TOKEN` and save it somewhere secure. Moon clients need this
   exact value after deployment.
4. Confirm the deployment.

Cloudflare creates the GitHub repository, provisions and binds the R2 bucket, stores the bearer
token as a Worker secret, deploys the Worker, and configures Workers Builds for subsequent pushes.
The deploy command also applies `r2-lifecycle.json` to the selected bucket, expiring cache objects
after seven days.

When deployment finishes, copy the resulting
`https://<worker>.<subdomain>.workers.dev` URL and continue with
[Configure moon](#configure-moon).

## Manual deployment

Prerequisites: a [Cloudflare account](https://dash.cloudflare.com/),
[Bun 1.4.2](https://bun.sh/), and permission to create Workers, R2 buckets, lifecycle rules, and
Worker secrets.

1. On GitHub, select **Use this template**, then clone your new repository.
2. Install the pinned workspace dependencies, then work from the cache service and authenticate Wrangler:

   ```sh
   bun install --frozen-lockfile
   cd services/cache
   bunx wrangler login
   ```

3. Review the Worker and bucket names in `services/cache/wrangler.jsonc` (relative to the repository
   root). The lifecycle setup automatically uses the bucket assigned to the `CACHE_BUCKET` binding.
4. Create the private Standard-class R2 bucket and its seven-day expiration rule:

   ```sh
   bun run provision
   ```

5. Generate a long random token and store it as a Worker secret. Keep this value: moon clients
   need the same token.

   ```sh
   openssl rand -hex 32
   bunx wrangler secret put CACHE_TOKEN
   ```

6. Deploy the Worker and re-apply its lifecycle configuration:

   ```sh
   bun run deploy
   ```

Wrangler prints the resulting `https://<worker>.<subdomain>.workers.dev` URL. Verify it without
putting the token in shell history by loading it into an environment variable first:

```sh
read -s CACHE_TOKEN
curl --fail --header "Authorization: Bearer ${CACHE_TOKEN}" https://<worker-url>/status
```

The response is `{"status":"ok"}`. Every endpoint, including `/status`, requires the token.

After the first manual deployment, you may connect the repository to
[Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) if you want
deployments from GitHub. Deployment automation is deliberately not part of this template's GitHub
Actions workflow.

## Configure moon

Add this to `.moon/workspace.yml` in every workspace that should use the cache:

```yaml
remote:
  api: "http"
  host: "https://<worker>.<subdomain>.workers.dev"
  auth:
    token: "MOON_REMOTE_CACHE_TOKEN"
  cache:
    instanceName: "your-organization/your-repository"
    verifyIntegrity: true
```

Then expose the same secret to moon locally or in CI:

```sh
export MOON_REMOTE_CACHE_TOKEN="<the Worker CACHE_TOKEN>"
```

The `auth.token` value is the *name* of the environment variable, not the token itself. If the
variable is absent, moon disables remote caching. Choose a stable instance name for each
repository. Nested values such as `organization/repository` are supported.

This follows moon's documented
[HTTP remote-cache configuration](https://moonrepo.dev/docs/guides/remote-cache) and uses the
[Bazel HTTP caching protocol](https://bazel.build/remote/caching#http-caching). It does not expose
gRPC and should not be presented as a general Bazel Remote Execution server.

## HTTP contract

| Method | Path | Success | Missing |
| --- | --- | --- | --- |
| `GET` | `/status` | `200` JSON | — |
| `PUT` | `/{instanceName}/ac/{sha256}` | `204` | — |
| `GET` | `/{instanceName}/ac/{sha256}` | `200` opaque bytes | `404` |
| `PUT` | `/{instanceName}/cas/{sha256}` | `204` | — |
| `GET` | `/{instanceName}/cas/{sha256}` | `200` opaque bytes | `404` |

All routes require `Authorization: Bearer <token>`. Digests must be lowercase, 64-character SHA256
hex strings. Cache responses use `Cache-Control: private, no-store`; R2 is the cache, not the
Cloudflare edge cache. AC and CAS bodies are opaque and are streamed without application-level
buffering.

The single token grants read and write access to every instance. Instance names partition object
keys but are not authorization boundaries. Rotate the token with `bunx wrangler secret put
CACHE_TOKEN` if it is exposed.

## Retention and cost

`r2-lifecycle.json` expires every object seven days after its latest upload. Cloudflare states that
expired objects are typically removed within 24 hours, so seven days is the configured retention
period rather than an exact deletion deadline. Re-uploading an existing cache key refreshes its
lifetime.

R2 has free internet egress, but storage, Worker requests, Class A writes, Class B reads, and usage
beyond included allowances can still cost money. Before deploying:

- choose a [Workers plan](https://developers.cloudflare.com/workers/platform/pricing/) whose
  request/body limits suit the largest artifacts your moon tasks produce;
- review current [Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
  [R2 limits](https://developers.cloudflare.com/r2/platform/limits/), and
  [R2 pricing](https://developers.cloudflare.com/r2/pricing/);
- configure Cloudflare usage notifications or billing controls appropriate for your account, and
  monitor request and storage volume after enabling clients.

The template cannot choose the correct plan or spending controls for a deployment.

## Observability

Each request produces exactly one structured deep event inside an Effect `http.request` span. It
contains request, response, auth outcome, cache instance/kind/digest/outcome/size/etag, Cloudflare
colo and Worker version, and trace/span IDs. Authorization values, request bodies, response bodies,
and arbitrary headers are never logged.

Cloudflare observability is enabled in `services/cache/wrangler.jsonc`. Inspect events in Workers Logs or route
them through the OpenTelemetry support already built into Effect if your deployment needs an
external backend.

## Workspace and development

The Bun + Moon v2 monorepo follows the `apps/*`, `services/*`, and `packages/*` layout:

```text
apps/website/       Static Vite + TypeScript website and generated logo
services/cache/     Standalone cache Worker, R2 lifecycle scripts, and tests
.moon/              Shared tasks and pinned JavaScript toolchains
.prototools         Bun, Node, and Moon versions for proto users
```

Install dependencies from the repository root with `bun install --frozen-lockfile`. The pinned
`@moonrepo/cli` dependency supplies Moon; a global installation is optional. Proto users can run
`proto use` to install the same versions used in delimoov's workspace.

```sh
bun run dev          # website
bun run dev:cache    # cache Worker (uses services/cache/.dev.vars)
bun run build        # both projects through Moon
bun run check
bun run typecheck
bun run test
bun run test:e2e
```

For local cache development, copy `services/cache/.dev.vars.example` to
`services/cache/.dev.vars` and replace the development token. Keep that file out of Git.

Tasks can also be addressed directly, for example `bunx moon run website:build` or
`bunx moon run cache:test-unit`. Build tasks declare their source inputs and output directories so
Moon can cache them. Integration and end-to-end tests always run against local workerd/R2. Remote
caching is not configured for this workspace by default, so building the cache does not require an
already-deployed cache or a cache token.

The end-to-end suite uses the workspace's pinned moon v2.5.4 client and proves a genuine remote
save-and-restore after deleting moon's local cache. GitHub Actions validates both projects; deployment
runs through Cloudflare Workers Builds. See [Cloudflare setup](docs/cloudflare.md) for the separate
website and cache build commands and the `remoshu.carere.dev` custom domain.

The [brand notes](docs/brand.md) include the generated logo and prompt. The website serves its fonts
locally and uses no runtime API or cache credentials.

## GitHub template setting

After publishing the source repository, open **Settings → General → Template repository** on GitHub
and enable the checkbox. This repository setting cannot be encoded in the template files.

## License

[MIT](LICENSE)
