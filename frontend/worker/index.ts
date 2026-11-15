/**
 * Cloudflare Worker for the PrF-G site (workers.dev).
 *
 *   /                    main menu (static, frontend/site/index.html)
 *   /demo/               the simulation (the Vite app, built into dist/demo)
 *   /presentation/       presentation viewer (static page that asks /presentation/info what to show)
 *   /presentation/info   JSON: which presentation file is in the repo right now
 *   /presentation/file   the presentation file itself, streamed from the repo
 *   /repo                redirect to the GitHub repository
 *   /api/*               forwarded to the FastAPI backend at BACKEND_URL (prefix removed)
 *
 * The presentation is read from GitHub at request time (raw.githubusercontent.com), so committing a new file to
 * the repo's presentation/ folder updates the site without a redeploy (GitHub's own cache: about 5 minutes).
 */

export interface Env {
  ASSETS: Fetcher;
  /** e.g. https://prf-g-api.onrender.com. Leave empty to run the demo on the on-board engine only. */
  BACKEND_URL?: string;
  /** Milliseconds to wait for the backend before giving up. */
  BACKEND_TIMEOUT_MS?: string;
  /** owner/name of the public GitHub repository. */
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
  /** Folder in the repo that holds the presentation. */
  PRESENTATION_DIR?: string;
}

const HOP_BY_HOP = ["connection", "keep-alive", "transfer-encoding", "upgrade", "host", "cf-connecting-ip", "x-forwarded-host"];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/* ------------------------------------------------------------------ backend proxy */

async function proxy(request: Request, env: Env, url: URL): Promise<Response> {
  const base = (env.BACKEND_URL ?? "").trim().replace(/\/$/, "");
  if (!base) return json(503, { error: "backend not configured", fallback: "on-board engine" });

  const target = new URL(base + (url.pathname.replace(/^\/api/, "") || "/") + url.search);
  const headers = new Headers(request.headers);
  for (const h of HOP_BY_HOP) headers.delete(h);

  const timeout = Number(env.BACKEND_TIMEOUT_MS ?? "8000") || 8000;
  try {
    const upstream = await fetch(target.toString(), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "follow",
      signal: AbortSignal.timeout(timeout),
    });
    const res = new Response(upstream.body, upstream);
    res.headers.set("cache-control", "no-store");
    return res;
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError" ? "backend timed out" : "backend unreachable";
    return json(503, { error: reason, fallback: "on-board engine" });
  }
}

/* ------------------------------------------------------------------ presentation from the repo */

type Kind = "pdf" | "pptx" | "link";
/** Looked for in this order inside PRESENTATION_DIR. The first one that exists is shown. */
const CANDIDATES: { name: string; kind: Kind; type: string }[] = [
  { name: "presentation.pdf", kind: "pdf", type: "application/pdf" },
  { name: "presentation.pptx", kind: "pptx", type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  { name: "link.txt", kind: "link", type: "text/plain; charset=utf-8" },
];

function repoInfo(env: Env) {
  const repo = (env.GITHUB_REPO ?? "paspyLapio/PrF-G").trim();
  const branch = (env.GITHUB_BRANCH ?? "main").trim();
  const dir = (env.PRESENTATION_DIR ?? "presentation").trim().replace(/^\/|\/$/g, "");
  return {
    repo, branch, dir,
    repoUrl: `https://github.com/${repo}`,
    raw: (name: string) => `https://raw.githubusercontent.com/${repo}/${branch}/${dir}/${name}`,
    uploadUrl: `https://github.com/${repo}/upload/${branch}/${dir}`,
    folderUrl: `https://github.com/${repo}/tree/${branch}/${dir}`,
  };
}

/** Short edge cache so a busy demo does not hit GitHub on every view; GitHub itself caches raw files ~5 min. */
const CF_CACHE = { cacheTtl: 60, cacheEverything: true } as const;

async function findPresentation(env: Env): Promise<{ c: (typeof CANDIDATES)[number]; res: Response } | null> {
  const r = repoInfo(env);
  for (const c of CANDIDATES) {
    const res = await fetch(r.raw(c.name), { cf: CF_CACHE });
    if (res.ok) return { c, res };
    await res.body?.cancel();
  }
  return null;
}

function firstUrl(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (/^https?:\/\//i.test(t)) return t;
  }
  return null;
}

async function presentationInfo(env: Env): Promise<Response> {
  const r = repoInfo(env);
  const base = { repoUrl: r.repoUrl, uploadUrl: r.uploadUrl, folderUrl: r.folderUrl, dir: r.dir };
  const found = await findPresentation(env);
  if (!found) return json(200, { ...base, kind: "none" });

  const { c, res } = found;
  if (c.kind === "link") {
    const url = firstUrl(await res.text());
    return json(200, url ? { ...base, kind: "link", url, name: c.name } : { ...base, kind: "none" });
  }
  await res.body?.cancel();
  return json(200, { ...base, kind: c.kind, name: c.name, file: "/presentation/file", raw: r.raw(c.name) });
}

async function presentationFile(env: Env, download: boolean): Promise<Response> {
  const found = await findPresentation(env);
  if (!found || found.c.kind === "link") return json(404, { error: "no presentation file in the repo" });
  const { c, res } = found;
  return new Response(res.body, {
    headers: {
      "content-type": c.type,
      "content-disposition": `${download ? "attachment" : "inline"}; filename="PrF-G-${c.name}"`,
      "cache-control": "public, max-age=60",
    },
  });
}

/* ------------------------------------------------------------------ router */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const p = url.pathname;

    if (p === "/api" || p.startsWith("/api/")) return proxy(request, env, url);
    if (p === "/repo" || p === "/repo/") return Response.redirect(repoInfo(env).repoUrl, 302);
    if (p === "/presentation/info") return presentationInfo(env);
    if (p === "/presentation/file") return presentationFile(env, url.searchParams.has("download"));

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
