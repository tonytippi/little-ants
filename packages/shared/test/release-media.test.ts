import { describe, expect, it } from 'vitest';
import { releaseMedia, type ReleaseMedia, type UnitReleasePayload } from '../src/release.js';

const media = (id: string): ReleaseMedia => ({
  id,
  kind: 'IMAGE',
  mimeType: 'image/jpeg',
  url: `https://media.example/${id}.jpg`,
  sizeBytes: 1,
  fileName: `${id}.jpg`,
});

function payload(unit: Partial<UnitReleasePayload['unit']>): UnitReleasePayload {
  return {
    format: 1,
    version: 1,
    publishedAt: '2026-10-22T00:00:00Z',
    unit: {
      code: 'U05',
      number: 5,
      title: 'Yummy Garden',
      level: { number: 1, name: 'Little Ants', ageBand: '3-4', lessonMinutes: '25' },
      leadCharacter: null,
      bigQuestion: '',
      value: '',
      party: '',
      sounds: [],
      keyLanguage: [],
      parentMessage: '',
      ...unit,
    },
    canDoGoals: [],
    words: [{ cardId: 'U05-02', text: 'banana', kind: 'CORE', group: '', image: media('banana') }],
    materials: [],
    lessons: [],
  };
}

describe('releaseMedia', () => {
  it('downloads the unit cover and place pictures once each', () => {
    const ids = releaseMedia(
      payload({
        cover: media('cover'),
        places: [
          { label: 'garden', image: media('garden') },
          { label: 'again', image: media('cover') },
        ],
      }),
    ).map((item) => item.id);
    expect(ids.sort()).toEqual(['banana', 'cover', 'garden']);
  });

  it('accepts releases published before unit pictures existed', () => {
    expect(releaseMedia(payload({})).map((item) => item.id)).toEqual(['banana']);
  });
});
