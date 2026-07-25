export interface CachePath {
  readonly digest: string;
  readonly instance: string;
  readonly key: string;
  readonly kind: "ac" | "cas";
}

export const parseCachePath = (url: string): CachePath | undefined => {
  const pathname = new URL(url).pathname;
  if (/%(?:2f|5c)/i.test(pathname) || pathname.includes("\\")) {
    return undefined;
  }

  const segments = pathname.slice(1).split("/");
  if (segments.length < 3 || segments.some((segment) => segment === "")) {
    return undefined;
  }

  const digest = segments.at(-1);
  const kind = segments.at(-2);
  if (digest === undefined || !/^[a-f0-9]{64}$/.test(digest)) {
    return undefined;
  }
  if (kind !== "ac" && kind !== "cas") {
    return undefined;
  }

  try {
    const instanceSegments = segments.slice(0, -2).map(decodeURIComponent);
    if (instanceSegments.some((segment) => segment === "." || segment === "..")) {
      return undefined;
    }

    const instance = instanceSegments.join("/");
    return {
      digest,
      instance,
      key: `${instance}/${kind}/${digest}`,
      kind,
    };
  } catch {
    return undefined;
  }
};
