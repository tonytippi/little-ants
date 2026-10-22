import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseEnv } from '../src/env.js';

const schema = z.object({ PORT: z.coerce.number().int(), SECRET: z.string().min(8) });

describe('parseEnv', () => {
  it('returns typed values', () => {
    expect(parseEnv(schema, { PORT: '3001', SECRET: 'long-enough' })).toEqual({
      PORT: 3001,
      SECRET: 'long-enough',
    });
  });

  it('treats empty values as not set', () => {
    const withDefault = z.object({
      PORT: z.coerce.number().default(3001),
      SECRET: z.string().min(8).optional(),
    });
    expect(parseEnv(withDefault, { PORT: '', SECRET: '' })).toEqual({ PORT: 3001 });
  });

  it('names invalid variables without echoing their values', () => {
    let message = '';
    try {
      parseEnv(schema, { PORT: 'abc', SECRET: 'short' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('PORT');
    expect(message).toContain('SECRET');
    expect(message).not.toContain('short');
  });
});
