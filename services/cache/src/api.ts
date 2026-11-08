import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { BearerAuth } from "./auth";

export const StatusResponse = Schema.Struct({
  status: Schema.Literal("ok"),
});

const status = HttpApiEndpoint.get("status", "/status", {
  success: StatusResponse,
});

const getCache = HttpApiEndpoint.get("getCache", "/*");
const putCache = HttpApiEndpoint.put("putCache", "/*");
const postFallback = HttpApiEndpoint.post("postFallback", "/*");
const patchFallback = HttpApiEndpoint.patch("patchFallback", "/*");
const deleteFallback = HttpApiEndpoint.delete("deleteFallback", "/*");
const headFallback = HttpApiEndpoint.head("headFallback", "/*");
const optionsFallback = HttpApiEndpoint.options("optionsFallback", "/*");

export const StatusApi = HttpApiGroup.make("status").add(status);

export const CacheApi = HttpApiGroup.make("cache").add(
  getCache,
  putCache,
  postFallback,
  patchFallback,
  deleteFallback,
  headFallback,
  optionsFallback,
);

export const RemoshuApi = HttpApi.make("remoshu")
  .add(StatusApi)
  .add(CacheApi)
  .middleware(BearerAuth);
