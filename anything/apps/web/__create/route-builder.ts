import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';

const API_BASENAME = '/api';
const api = new Hono();
const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
const routeImporters = import.meta.glob<RouteModule>('../src/app/api/**/route.js');

type RouteHandler = (
  request: Request,
  context?: { params: Record<string, string> }
) => Promise<Response> | Response;

type RouteModule = Partial<Record<(typeof httpMethods)[number], RouteHandler>>;

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

const getSortedRouteFiles = (routeFiles: string[]) => {
  return routeFiles.slice().sort((a, b) => b.length - a.length);
};

function getHonoPath(routeFile: string): { name: string; pattern: string }[] {
  const relativePath = routeFile.replace('../src/app/api', '');
  const parts = relativePath.split('/').filter(Boolean);
  const routeParts = parts.slice(0, -1);

  if (routeParts.length === 0) {
    return [{ name: 'root', pattern: '' }];
  }

  return routeParts.map((segment) => {
    const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
    if (match) {
      const [_, dots, param] = match;
      return dots === '...'
        ? { name: param, pattern: `:${param}{.+}` }
        : { name: param, pattern: `:${param}` };
    }

    return { name: segment, pattern: segment };
  });
}

function registerLoadedRoutes(routeModules: Record<string, RouteModule>) {
  api.routes = [];

  for (const routeFile of getSortedRouteFiles(Object.keys(routeModules))) {
    const route = routeModules[routeFile];
    if (!route) {
      continue;
    }

    const parts = getHonoPath(routeFile);
    const honoPath = `/${parts.map(({ pattern }) => pattern).join('/')}`;
    const getFreshRoute = import.meta.env.DEV ? routeImporters[routeFile] : undefined;

    for (const method of httpMethods) {
      const routeHandler = route[method];
      if (!routeHandler) {
        continue;
      }

      const handler: Handler = async (c) => {
        const params = c.req.param();
        const currentRoute =
          import.meta.env.DEV && getFreshRoute
            ? await getFreshRoute().catch((error) => {
                console.error(`Error reloading route file ${routeFile}:`, error);
                return route;
              })
            : route;
        const currentHandler = currentRoute[method];

        if (!currentHandler) {
          return new Response(`Route handler ${method} not found for ${routeFile}`, {
            status: 500,
          });
        }

        return await currentHandler(c.req.raw, { params });
      };

      switch (method.toLowerCase()) {
        case 'get':
          api.get(honoPath, handler);
          break;
        case 'post':
          api.post(honoPath, handler);
          break;
        case 'put':
          api.put(honoPath, handler);
          break;
        case 'delete':
          api.delete(honoPath, handler);
          break;
        case 'patch':
          api.patch(honoPath, handler);
          break;
        default:
          console.warn(`Unsupported method: ${method}`);
          break;
      }
    }
  }
}

async function registerRoutes() {
  const loadedRoutes: Record<string, RouteModule> = {};

  for (const routeFile of getSortedRouteFiles(Object.keys(routeImporters))) {
    const loadRoute = routeImporters[routeFile];
    if (!loadRoute) {
      continue;
    }

    try {
      loadedRoutes[routeFile] = await loadRoute();
    } catch (error) {
      console.error(`Error importing route file ${routeFile}:`, error);
    }
  }

  registerLoadedRoutes(loadedRoutes);
}

let routesReady: Promise<void> = import.meta.env.DEV
  ? registerRoutes()
  : registerRoutes();

if (import.meta.env.DEV) {
  import.meta.glob('../src/app/api/**/route.js', {
    eager: true,
  });

  if (import.meta.hot) {
    import.meta.hot.accept(() => {
      routesReady = registerRoutes().catch((error) => {
        console.error('Error reloading routes:', error);
      });
    });
  }
}

export { api, API_BASENAME, routesReady };
