import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './test-app.js';

describe('GET /health', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('reports ok when the database answers, without sign-in', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
