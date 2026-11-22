import { LoggerService } from '@backstage/backend-plugin-api';
import { InputError, ServiceUnavailableError } from '@backstage/errors';
import { Request, RequestHandler } from 'express';
import {
  DashboardQuery,
  parseQuery,
  sourceCapabilities,
  QueryError,
} from '@moatazeldebsy/claude-metrics-lib/server';

/** Search params of a request, as the Nuxt routes saw them. */
const searchParams = (req: Request) =>
  new URL(req.originalUrl, 'http://x').searchParams;

/**
 * Wrap a route: parse the dashboard filters, map validation errors to 400 and upstream failures
 * to 503 (Backstage has no 502 error class; the message is kept either way).
 */
export function dashboard(
  logger: LoggerService,
  fn: (q: DashboardQuery, sp: URLSearchParams) => Promise<unknown>,
): RequestHandler {
  return async (req, res) => {
    const sp = searchParams(req);
    let q: DashboardQuery;
    try {
      q = parseQuery(sp, undefined, {
        includeToday: sourceCapabilities().includesToday,
      });
    } catch (e) {
      if (e instanceof QueryError) throw new InputError(e.message);
      throw e;
    }
    try {
      res.json(await fn(q, sp));
    } catch (e) {
      logger.error('claude-metrics upstream error', e as Error);
      throw new ServiceUnavailableError(
        e instanceof Error ? e.message : 'upstream error',
      );
    }
  };
}

export const intParam = (
  sp: URLSearchParams,
  key: string,
  fallback: number,
  max = Infinity,
) => Math.min(max, Math.max(1, Number(sp.get(key)) || fallback));
