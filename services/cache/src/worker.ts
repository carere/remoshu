import { webHandler } from "./server";

export default {
  fetch(request: Request): Promise<Response> {
    const handler = webHandler.handler as (request: Request) => Promise<Response>;
    return handler(request);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
