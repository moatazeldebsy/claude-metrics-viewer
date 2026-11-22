/** HTTP client for a running Claude Metrics dashboard's read API (`/api/*`). */

export type Params = Record<string, string | number | boolean | undefined>;

export class DashboardError extends Error {}

/** Dashboard origin from CLAUDE_METRICS_URL (the plugin fills it from its `dashboard_url` option), else localhost. */
export function dashboardUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.CLAUDE_METRICS_URL || "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

/** `/api/<route>?…`, leaving out unset parameters so the dashboard applies its own defaults. */
export function buildUrl(base: string, route: string, params: Params = {}): string {
  const url = new URL(`api/${route}`, base + "/");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function getJson(base: string, route: string, params: Params = {}, fetchFn: typeof fetch = fetch): Promise<unknown> {
  const url = buildUrl(base, route, params);
  let res: Response;
  try {
    res = await fetchFn(url, { headers: { accept: "application/json" } });
  } catch (e) {
    throw new DashboardError(`Can't reach the Claude Metrics dashboard at ${base} (${e instanceof Error ? e.message : e}). Is it running? Set CLAUDE_METRICS_URL or the plugin's dashboard_url option to its origin.`);
  }
  const text = await res.text();
  if (!res.ok) {
    let message = text.slice(0, 500);
    try {
      const body = JSON.parse(text) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // not JSON: keep the raw text
    }
    throw new DashboardError(`${res.status} from ${url}: ${message}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new DashboardError(`${url} didn't return JSON. Is ${base} a Claude Metrics dashboard?`);
  }
}
