import { resetTestDatabase } from '../src/testing.js';

export const TEST_SCHEMA = 'test_db';

export default async function setup(): Promise<void> {
  await resetTestDatabase(TEST_SCHEMA);
}
