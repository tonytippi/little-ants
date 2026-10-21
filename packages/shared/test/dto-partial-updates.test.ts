import { describe, expect, it } from 'vitest';
import {
  campusUpdate,
  classInput,
  classUpdate,
  materialUpdate,
  staffUpdate,
  studentInput,
  studentUpdate,
  unitUpdate,
  wordInput,
  wordUpdate,
} from '../src/index.js';

describe('update schemas change only the fields that were sent', () => {
  it.each([
    ['class', classUpdate, { nextLesson: 12 }],
    ['campus', campusUpdate, { name: 'Main' }],
    ['student', studentUpdate, { displayName: 'Bé An' }],
    ['word', wordUpdate, { text: 'hello' }],
    ['material', materialUpdate, { title: 'Hello song' }],
    ['unit', unitUpdate, { title: 'Hello, Little Ants!' }],
    ['staff', staffUpdate, { active: false }],
  ])('%s', (_name, schema, body) => {
    expect(schema.parse(body)).toEqual(body);
  });
});

describe('create schemas still fill in defaults', () => {
  it('class', () => {
    const parsed = classInput.parse({ campusId: 'c', name: 'Bees', levelId: 'l', schoolYear: '2026-2027' });
    expect(parsed).toMatchObject({ currentUnitId: null, nextLesson: 1, lessonDays: [1, 2, 3, 4], active: true });
  });

  it('student and word', () => {
    expect(studentInput.parse({ displayName: 'Bé Na' })).toEqual({ displayName: 'Bé Na', birthYear: null, consentAt: null });
    expect(wordInput.parse({ cardId: 'U01-41', text: 'sun' })).toMatchObject({ kind: 'CORE', pictureBrief: '', imageAssetId: null });
  });
});
