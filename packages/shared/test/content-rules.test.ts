import { describe, expect, it } from 'vitest';
import { checkUnitRules, repeatedSounds, type RuleInput } from '../src/content-rules.js';

function baseInput(overrides: Partial<RuleInput> = {}): RuleInput {
  return {
    unitCode: 'U02',
    isFirstUnit: false,
    rules: { coreWordsPerUnit: [2, 3], storyPages: [2, 3], maxWordsPerPage: 4 },
    words: [
      { cardId: 'U02-01', kind: 'CORE', pictureBrief: 'a face' },
      { cardId: 'U02-02', kind: 'CORE', pictureBrief: 'a hand' },
      { cardId: 'U02-03', kind: 'REVIEW', pictureBrief: 'a cat' },
    ],
    materials: [
      { code: 'ST1', type: 'STORY', title: 'Story', fullText: '', pageTexts: ['I see a cat.', 'Hello!'] },
    ],
    lessons: [
      {
        number: 1,
        minutes: 10,
        newToday: ['ST1'],
        steps: [{ title: 'ST1 Story', minutes: 10, materialCode: 'ST1' }],
      },
    ],
    expectedLessons: 1,
    ...overrides,
  };
}

describe('repeatedSounds', () => {
  it('finds a sound listed twice', () => {
    expect(repeatedSounds('Sound Trail: m /m/ + m /m/')).toEqual(['m /m/']);
    expect(repeatedSounds('Sound Trail: s /s/ + m /m/')).toEqual([]);
    expect(repeatedSounds('RH1 Happy Friends')).toEqual([]);
  });
});

describe('checkUnitRules', () => {
  it('passes a unit that follows the rules', () => {
    expect(checkUnitRules(baseInput())).toEqual([]);
  });

  it('flags the problems found in the Unit 1 lesson plans', () => {
    const findings = checkUnitRules(
      baseInput({
        lessons: [
          {
            number: 1,
            minutes: 10,
            newToday: ['BB9'],
            steps: [
              { title: 'Sound Trail: m /m/ + m /m/', minutes: 5, materialCode: 'SN' },
              { title: 'MD2 I Say, You Do', minutes: 5, materialCode: 'MD2' },
            ],
          },
        ],
      }),
    );
    expect(findings.map((finding) => finding.rule)).toEqual([
      'repeated-sound',
      'missing-material',
      'missing-material',
      'missing-material',
    ]);
  });

  it('checks word counts, review share and story limits', () => {
    const findings = checkUnitRules(
      baseInput({
        words: [{ cardId: 'U02-01', kind: 'CORE', pictureBrief: '' }],
        materials: [
          {
            code: 'ST1',
            type: 'STORY',
            title: 'Story',
            fullText: '',
            pageTexts: ['One two three four five six'],
          },
        ],
      }),
    );
    expect(findings.map((finding) => finding.rule).sort()).toEqual(
      ['core-word-count', 'picture-brief', 'review-share', 'story-pages', 'words-per-page'].sort(),
    );
  });

  it('does not ask the first unit for review words', () => {
    const findings = checkUnitRules(baseInput({ isFirstUnit: true, words: baseInput().words.slice(0, 2) }));
    expect(findings.find((finding) => finding.rule === 'review-share')).toBeUndefined();
  });

  it('reports missing lessons', () => {
    const findings = checkUnitRules(baseInput({ expectedLessons: 2 }));
    expect(findings).toContainEqual(expect.objectContaining({ rule: 'lesson-count' }));
    expect(findings).toContainEqual(expect.objectContaining({ rule: 'lesson-missing', where: 'lesson 2' }));
  });
});
