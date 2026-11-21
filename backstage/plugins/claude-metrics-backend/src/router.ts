import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { dataSourceName, departmentList, holidayCountry } from './lib';

export async function createRouter(_options: {
  logger: LoggerService;
  httpAuth: HttpAuthService;
}): Promise<express.Router> {
  const router = Router();

  router.get('/meta', async (_req, res) => {
    res.json({
      dataSource: dataSourceName(),
      holidayCountry: holidayCountry(),
      departments: await departmentList(),
    });
  });

  return router;
}
