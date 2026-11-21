import { mockErrorHandler, mockServices } from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';

import { createRouter } from './router';

describe('createRouter', () => {
  let app: express.Express;

  beforeAll(async () => {
    const router = await createRouter({
      logger: mockServices.logger.mock(),
      httpAuth: mockServices.httpAuth(),
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
});
