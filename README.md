# Remoshu

A moon HTTP remote cache for Cloudflare Workers and R2.

Remoshu implements the small HTTP action-cache (AC) and content-addressable-storage (CAS)
surface used by moon v2. Cache objects are streamed through a Worker into a private R2 bucket,
authenticated with one bearer token, and expired after seven days by an R2 lifecycle rule.

The project is intentionally a GitHub template, not a hosted multi-tenant service. Create a
repository from the template, deploy it into the Cloudflare account of your choice, and point one
or more moon workspaces at it.

## Deploy

Prerequisites: a [Cloudflare account](https://dash.cloudflare.com/),
[Bun 1.3.14](https://bun.sh/), and permission to create Workers, R2 buckets, lifecycle rules, and
Worker secrets.

1. On GitHub, select **Use this template**, then clone your new repository.
2. Install the pinned dependencies and authenticate Wrangler:

   ```sh
   bun install --frozen-lockfile
   bunx wrangler login
   ```

3. Review the Worker and bucket names in `wrangler.jsonc`. If you rename the bucket, update both
   the `bucket_name` there and the two `provision:*` scripts in `package.json`.
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

6. Deploy the Worker:

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

Cloudflare observability is enabled in `wrangler.jsonc`. Inspect events in Workers Logs or route
them through the OpenTelemetry support already built into Effect if your deployment needs an
external backend.

## Development

Copy `.dev.vars.example` to `.dev.vars`, replace the token, then run:

```sh
bun install --frozen-lockfile
bun run dev
```

Quality checks:

```sh
bun run check
bun run typecheck
bun run test:unit
bun run test:integration
bun run test:e2e
bun run build
```

The integration suite runs the Worker against local R2. The end-to-end suite requires moon v2.4.5
on `PATH` and proves a genuine remote save-and-restore after deleting moon's local cache.

## GitHub template setting

After publishing the source repository, open **Settings → General → Template repository** on GitHub
and enable the checkbox. This repository setting cannot be encoded in the template files.

## License

[MIT](LICENSE)
