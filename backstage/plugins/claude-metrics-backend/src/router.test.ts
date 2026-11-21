import { mockErrorHandler, mockServices } from '@backstage/backend-test-utils';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import express from 'express';
import request from 'supertest';

import { createRouter } from './router';

const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

describe('createRouter', () => {
  let app: express.Express;

  beforeAll(async () => {
    const router = await createRouter({
      logger: mockServices.logger.mock(),
      httpAuth: mockServices.httpAuth(),
      permissions: mockServices.permissions({ result: AuthorizeResult.ALLOW }),
    });
    app = express();
    app.use(router);
    app.use(mockErrorHandler());
  });

  it('GET /meta returns mock metadata', async () => {
    const res = await request(app).get('/meta');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      dataSource: 'mock',
      holidayCountry: 'US',
      departments: expect.any(Array),
    });
    expect(res.body.departments.length).toBeGreaterThan(5);
  });

  it('GET /claude-code returns KPIs, 28 daily points and top contributors', async () => {
    const res = await request(app).get('/claude-code');
    expect(res.status).toBe(200);
    expect(res.body.kpis.activeUsers).toBeGreaterThan(0);
    expect(res.body.daily).toHaveLength(28);
    expect(res.body.topContributors.length).toBeLessThanOrEqual(10);
  });

  it('GET /departments returns department rows', async () => {
    const res = await request(app).get('/departments');
    expect(res.status).toBe(200);
    expect(res.body.rows[0]).toEqual(
      expect.objectContaining({
        department: expect.any(String),
        adoption: expect.any(Number),
        tiers: expect.any(Object),
      }),
    );
  });

  it('GET /users clamps pageSize to 100 and page to the last page', async () => {
    const res = await request(app).get('/users?pageSize=500&page=999');
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBeLessThanOrEqual(100);
    expect(res.body.rows.length).toBeGreaterThan(0);
    expect(res.body.page).toBe(res.body.pages);
  });

  it('GET /users falls back to sessions desc for an unknown sort key', async () => {
    const res = await request(app).get('/users?sort=bogus');
    const sessions = res.body.rows.map((r: { sessions: number }) => r.sessions);
    expect(sessions).toEqual([...sessions].sort((a, b) => b - a));
  });

  it('GET /user-search returns at most 20 options', async () => {
    const res = await request(app).get('/user-search?q=a');
    expect(res.status).toBe(200);
    expect(res.body.options.length).toBeGreaterThan(0);
    expect(res.body.options.length).toBeLessThanOrEqual(20);
  });

  it('GET /seats returns seat totals and a 25-row idle page', async () => {
    const res = await request(app).get('/seats');
    expect(res.status).toBe(200);
    expect(res.body.totalSeats).toBe(1200);
    expect(res.body.idle.rows.length).toBeLessThanOrEqual(25);
  });

  it('GET /cost rolls up by all six dimensions', async () => {
    const res = await request(app).get('/cost');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.by).sort()).toEqual([
      'api_key_id',
      'cost_type',
      'model',
      'product',
      'service_tier',
      'workspace_id',
    ]);
  });

  it('GET /raw?source=cost returns cost rows for the last day', async () => {
    const res = await request(app).get('/raw?source=cost');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.day).toBe(day(-1));
  });

  it('rejects from after to with 400', async () => {
    const res = await request(app).get(
      '/claude-code?from=2026-02-10&to=2026-02-01',
    );
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('from must be on or before to');
  });

  it('rejects to = today with 400', async () => {
    const res = await request(app).get(`/claude-code?to=${day(0)}`);
    expect(res.status).toBe(400);
  });
});

describe('permission check', () => {
  const appWith = async (
    permissions: Parameters<typeof createRouter>[0]['permissions'],
  ) => {
    const app = express();
    app.use(
      await createRouter({
        logger: mockServices.logger.mock(),
        httpAuth: mockServices.httpAuth(),
        permissions,
      }),
    );
    app.use(mockErrorHandler());
    return app;
  };

  it.each(['/meta', '/claude-code', '/users', '/raw'])(
    'returns 403 on %s when the policy denies',
    async path => {
      const app = await appWith(
        mockServices.permissions({ result: AuthorizeResult.DENY }),
      );
      const res = await request(app).get(path);
      expect(res.status).toBe(403);
    },
  );

  it('asks the policy about claude-metrics.dashboard.read for the caller', async () => {
    const authorize = jest.fn(
      async (): Promise<{ result: AuthorizeResult.ALLOW }[]> => [
        { result: AuthorizeResult.ALLOW },
      ],
    );
    const app = await appWith(mockServices.permissions.mock({ authorize }));
    const res = await request(app).get('/meta');
    expect(res.status).toBe(200);
    expect(authorize).toHaveBeenCalledWith(
      [
        {
          permission: expect.objectContaining({
            name: 'claude-metrics.dashboard.read',
          }),
        },
      ],
      {
        credentials: expect.objectContaining({
          principal: expect.objectContaining({ type: 'user' }),
        }),
      },
    );
  });
});
