import { env } from "cloudflare:workers";
import { Context, Layer } from "effect";

interface RuntimeConfigShape {
  readonly cacheToken: () => string;
}

type WorkerEnv = Cloudflare.Env & {
  readonly CACHE_TOKEN: string;
};

export class RuntimeConfig extends Context.Service<RuntimeConfig, RuntimeConfigShape>()(
  "remoshu/RuntimeConfig",
) {}

export const RuntimeConfigLive = Layer.succeed(RuntimeConfig, {
  cacheToken: () => (env as WorkerEnv).CACHE_TOKEN,
});
