import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import type { Auth } from './auth/auth.js';
import { AUTH } from './auth/session-resolver.js';
import { originCheck } from './common/origin-check.js';
import { loadEnv } from './config/env.js';

/**
 * App-wide settings shared by the server entry point and e2e tests.
 * The app must be created with `bodyParser: false`: Better Auth reads the raw request body,
 * so its handler is mounted before the JSON body parser.
 */
export function configureApp(app: INestApplication): INestApplication {
  const expressApp = app as NestExpressApplication;
  const env = loadEnv();
  expressApp.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  expressApp.set('trust proxy', 1); // behind Cloudflare Tunnel
  const auth = app.get<Auth>(AUTH);
  const http = expressApp.getHttpAdapter().getInstance();
  // Better Auth handles its own routes (and their origin checks); every other write goes through originCheck.
  http.all('/api/auth/{*path}', toNodeHandler(auth));
  http.use(originCheck(env.CORS_ORIGINS));
  expressApp.useBodyParser('json', { limit: '2mb' });
  expressApp.setGlobalPrefix('api', { exclude: ['health'] });
  expressApp.enableShutdownHooks();
  return app;
}
