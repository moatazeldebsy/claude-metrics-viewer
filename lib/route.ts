import { NextResponse } from "next/server";
import { parseQuery, QueryError, type DashboardQuery } from "@/lib/query";

/** Wrap a handler: parse filters, map validation errors to 400, upstream failures to 502. */
export function handler<T>(fn: (q: DashboardQuery, sp: URLSearchParams) => Promise<T>) {
  return async (req: Request) => {
    const sp = new URL(req.url).searchParams;
    try {
      return NextResponse.json(await fn(parseQuery(sp), sp));
    } catch (e) {
      if (e instanceof QueryError) return NextResponse.json({ error: e.message }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: e instanceof Error ? e.message : "upstream error" }, { status: 502 });
    }
  };
}
