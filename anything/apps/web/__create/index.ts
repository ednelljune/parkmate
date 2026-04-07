import { AsyncLocalStorage } from 'node:async_hooks';
import nodeConsole from 'node:console';
import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { cors } from 'hono/cors';
import { proxy } from 'hono/proxy';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import { createHonoServer } from 'react-router-hono-server/node';
import { serializeError } from 'serialize-error';
import { getHTMLForErrorPage } from './get-html-for-error-page';
import { API_BASENAME, api, routesReady } from './route-builder';
import * as notificationsActivityRoute from '../src/app/api/notifications/activity/route.js';
import * as notificationsCreateRoute from '../src/app/api/notifications/create/route.js';
import * as notificationsListRoute from '../src/app/api/notifications/list/route.js';
import * as notificationsRegisterTokenRoute from '../src/app/api/notifications/register-token/route.js';
import * as notificationsSendAlertRoute from '../src/app/api/notifications/send-alert/route.js';
import * as notificationsSendPushRoute from '../src/app/api/notifications/send-push/route.js';
import * as reportsClaimRoute from '../src/app/api/reports/claim/route.js';
import * as reportsCreateRoute from '../src/app/api/reports/create/route.js';
import * as reportsDeleteRoute from '../src/app/api/reports/delete/route.js';
import * as reportsNearbyRoute from '../src/app/api/reports/nearby/route.js';
import * as reportsReportFalseRoute from '../src/app/api/reports/report-false/route.js';
import * as usersLeaderboardRoute from '../src/app/api/users/leaderboard/route.js';
import * as usersProfileRoute from '../src/app/api/users/profile/route.js';
import * as zonesAtLocationRoute from '../src/app/api/zones/at-location/route.js';
import * as zonesImportVictoriaPublicRoute from '../src/app/api/zones/import-victoria-public/route.js';
import * as zonesListRoute from '../src/app/api/zones/list/route.js';
import * as zonesSeedSampleRoute from '../src/app/api/zones/seed-sample/route.js';

const als = new AsyncLocalStorage<{ requestId: string }>();

for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
  const original = nodeConsole[method].bind(console);

  console[method] = (...args: unknown[]) => {
    const requestId = als.getStore()?.requestId;
    if (requestId) {
      original(`[traceId:${requestId}]`, ...args);
    } else {
      original(...args);
    }
  };
}

const app = new Hono();

const mountRoute = (
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  handler?: ((request: Request, context?: { params: Record<string, string> }) => Promise<Response> | Response) | null
) => {
  if (!handler) {
    return;
  }

  app[method](path, async (c) => {
    return await handler(c.req.raw, { params: c.req.param() });
  });
};

app.use('*', requestId());

app.use('*', (c, next) => {
  const requestId = c.get('requestId');
  return als.run({ requestId }, () => next());
});

app.use(contextStorage());

app.onError((err, c) => {
  if (c.req.method !== 'GET') {
    return c.json(
      {
        error: 'An error occurred in your app',
        details: serializeError(err),
      },
      500
    );
  }
  return c.html(getHTMLForErrorPage(err), 200);
});

if (process.env.CORS_ORIGINS) {
  app.use(
    '/*',
    cors({
      origin: process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    })
  );
}
for (const method of ['post', 'put', 'patch'] as const) {
  app[method](
    '*',
    bodyLimit({
      maxSize: 4.5 * 1024 * 1024, // 4.5mb to match vercel limit
      onError: (c) => {
        return c.json({ error: 'Body size limit exceeded' }, 413);
      },
    })
  );
}

app.all('/integrations/:path{.+}', async (c, next) => {
  const queryParams = c.req.query();
  const url = `${process.env.NEXT_PUBLIC_CREATE_BASE_URL ?? 'https://www.create.xyz'}/integrations/${c.req.param('path')}${Object.keys(queryParams).length > 0 ? `?${new URLSearchParams(queryParams).toString()}` : ''}`;

  return proxy(url, {
    method: c.req.method,
    body: c.req.raw.body ?? null,
    // @ts-ignore - this key is accepted even if types not aware and is
    // required for streaming integrations
    duplex: 'half',
    redirect: 'manual',
    headers: {
      ...c.req.header(),
      'X-Forwarded-For': process.env.NEXT_PUBLIC_CREATE_HOST,
      'x-createxyz-host': process.env.NEXT_PUBLIC_CREATE_HOST,
      Host: process.env.NEXT_PUBLIC_CREATE_HOST,
      'x-createxyz-project-group-id': process.env.NEXT_PUBLIC_PROJECT_GROUP_ID,
    },
  });
});

mountRoute('get', '/api/notifications/activity', notificationsActivityRoute.GET);
mountRoute('post', '/api/notifications/create', notificationsCreateRoute.POST);
mountRoute('post', '/api/notifications/list', notificationsListRoute.POST);
mountRoute('post', '/api/notifications/register-token', notificationsRegisterTokenRoute.POST);
mountRoute('post', '/api/notifications/send-alert', notificationsSendAlertRoute.POST);
mountRoute('post', '/api/notifications/send-push', notificationsSendPushRoute.POST);

mountRoute('post', '/api/reports/claim', reportsClaimRoute.POST);
mountRoute('post', '/api/reports/create', reportsCreateRoute.POST);
mountRoute('post', '/api/reports/delete', reportsDeleteRoute.POST);
mountRoute('post', '/api/reports/nearby', reportsNearbyRoute.POST);
mountRoute('post', '/api/reports/report-false', reportsReportFalseRoute.POST);

mountRoute('get', '/api/users/leaderboard', usersLeaderboardRoute.GET);
mountRoute('get', '/api/users/profile', usersProfileRoute.GET);
mountRoute('post', '/api/users/profile', usersProfileRoute.POST);

mountRoute('post', '/api/zones/at-location', zonesAtLocationRoute.POST);
mountRoute('get', '/api/zones/list', zonesListRoute.GET);
mountRoute('post', '/api/zones/list', zonesListRoute.POST);
mountRoute('post', '/api/zones/import-victoria-public', zonesImportVictoriaPublicRoute.POST);
mountRoute('post', '/api/zones/seed-sample', zonesSeedSampleRoute.POST);

app.route(API_BASENAME, api);

export default createHonoServer({
  app,
  defaultLogger: false,
  beforeAll: async () => {
    await routesReady;
  },
});
