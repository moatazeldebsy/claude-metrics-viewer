import type { H3Event } from "h3";
import { parseQuery, QueryError, type DashboardQuery } from "#lib/query";

/** Wrap a handler: parse filters, map validation errors to 400 and upstream failures to 502. */
export function defineDashboardHandler<T>(fn: (q: DashboardQuery, sp: URLSearchParams, event: H3Event) => Promise<T>) {
  return defineEventHandler(async (event) => {
    const sp = getRequestURL(event).searchParams;
    let q: DashboardQuery;
    try {
      q = parseQuery(sp);
    } catch (e) {
      if (e instanceof QueryError) throw createError({ statusCode: 400, message: e.message });
      throw e;
    }
    try {
      return await fn(q, sp, event);
    } catch (e) {
      console.error(e);
      throw createError({ statusCode: 502, message: e instanceof Error ? e.message : "upstream error" });
    }
  });
}

export const intParam = (sp: URLSearchParams, key: string, fallback: number, max = Infinity) =>
  Math.min(max, Math.max(1, Number(sp.get(key)) || fallback));
