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
  /** Optional: exact file name in that folder to show, instead of picking automatically. */
  PRESENTATION_FILE?: string;
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
interface Pick { name: string; kind: Kind; type: string }

/** File kinds in order of preference: a PDF wins over a PowerPoint, which wins over a link. */
const KINDS: { kind: Kind; test: RegExp; type: string; preferred: string }[] = [
  { kind: "pdf", test: /\.pdf$/i, type: "application/pdf", preferred: "presentation.pdf" },
  { kind: "pptx", test: /\.pptx$/i, type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", preferred: "presentation.pptx" },
  { kind: "link", test: /^link\.txt$/i, type: "text/plain; charset=utf-8", preferred: "link.txt" },
];

function classify(name: string): Pick | null {
  const k = KINDS.find((k) => k.test.test(name));
  return k ? { name, kind: k.kind, type: k.type } : null;
}

function repoInfo(env: Env) {
  const repo = (env.GITHUB_REPO ?? "paspyLapio/PrF-G").trim();
  const branch = (env.GITHUB_BRANCH ?? "main").trim();
  const dir = (env.PRESENTATION_DIR ?? "presentation").trim().replace(/^\/|\/$/g, "");
  const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");
  return {
    repo, branch, dir,
    repoUrl: `https://github.com/${repo}`,
    raw: (name: string) => `https://raw.githubusercontent.com/${repo}/${enc(branch)}/${enc(dir)}/${encodeURIComponent(name)}`,
    listUrl: `https://api.github.com/repos/${repo}/contents/${enc(dir)}?ref=${encodeURIComponent(branch)}`,
    uploadUrl: `https://github.com/${repo}/upload/${branch}/${dir}`,
    folderUrl: `https://github.com/${repo}/tree/${branch}/${dir}`,
  };
}

/** Short edge cache so a busy demo does not hit GitHub on every view; GitHub itself caches raw files ~5 min. */
const CF_CACHE = { cacheTtl: 60, cacheEverything: true } as const;

/** File names in the presentation folder, via the GitHub API (cached 2 min). null if the API is unavailable. */
async function listFolder(env: Env): Promise<string[] | null> {
  try {
    const res = await fetch(repoInfo(env).listUrl, {
      headers: { "user-agent": "prf-g-site", accept: "application/vnd.github+json" },
      cf: { cacheTtl: 120, cacheEverything: true },
    });
    if (res.status === 404) return [];
    if (!res.ok) return null;
    const items = (await res.json()) as { name: string; type: string }[];
    return Array.isArray(items) ? items.filter((i) => i.type === "file").map((i) => i.name) : null;
  } catch {
    return null;
  }
}

/** Which file to show: PRESENTATION_FILE if set, else the best file in the folder, else the standard names. */
async function choose(env: Env): Promise<Pick | null> {
  const pinned = (env.PRESENTATION_FILE ?? "").trim();
  if (pinned) return classify(pinned);
  const names = await listFolder(env);
  if (names) {
    for (const k of KINDS) {
      const matches = names.filter((n) => k.test.test(n)).sort((a, b) => a.localeCompare(b));
      if (matches.length) return classify(matches.find((n) => n.toLowerCase() === k.preferred) ?? matches[0]);
    }
    return null;
  }
  // GitHub API unavailable (rate limit): try the standard names directly.
  for (const k of KINDS) {
    const res = await fetch(repoInfo(env).raw(k.preferred), { method: "HEAD", cf: CF_CACHE });
    if (res.ok) return classify(k.preferred);
  }
  return null;
}

async function findPresentation(env: Env): Promise<{ c: Pick; res: Response } | null> {
  const c = await choose(env);
  if (!c) return null;
  const res = await fetch(repoInfo(env).raw(c.name), { cf: CF_CACHE });
  if (!res.ok) { await res.body?.cancel(); return null; }
  return { c, res };
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
  const safe = c.name.replace(/[^\w.\- ]+/g, "_");
  const headers = new Headers({
    "content-type": c.type,
    "content-disposition": `${download ? "attachment" : "inline"}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(c.name)}`,
    "cache-control": "public, max-age=60",
  });
  const len = res.headers.get("content-length");
  if (len) headers.set("content-length", len); // lets the PDF viewer show progress
  return new Response(res.body, { headers });
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
