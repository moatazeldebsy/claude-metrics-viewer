import { createBackend } from '@backstage/backend-defaults';
import { mockServices } from '@backstage/backend-test-utils';

// Development backend for the plugin. Start it with `yarn start` in this package, then e.g.:
//
//   curl http://localhost:7007/api/claude-metrics/meta
//
// Auth is mocked so the API can be called without signing in.
const backend = createBackend();

backend.add(mockServices.auth.factory());
backend.add(mockServices.httpAuth.factory());
backend.add(import('../src'));

backend.start();
