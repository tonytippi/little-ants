import { describe, expect, it } from 'vitest';
import { testDataAfterSync, testDataReport } from '../src/test-data.js';

describe('test data after sync', () => {
  it('is on only when TEST_DATA_AFTER_SYNC is true', () => {
    expect(testDataAfterSync({})).toBe(false);
    expect(testDataAfterSync({ TEST_DATA_AFTER_SYNC: 'false' })).toBe(false);
    expect(testDataAfterSync({ TEST_DATA_AFTER_SYNC: ' true ' })).toBe(true);
    expect(testDataAfterSync({ TEST_DATA_AFTER_SYNC: '1' })).toBe(true);
  });

  it('lists what seed-test did in the import report', () => {
    expect(testDataReport(['U05: approved 144 items, published version 1'])).toContain(
      '- U05: approved 144 items, published version 1',
    );
  });
});
