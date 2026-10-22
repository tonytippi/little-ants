import { describe, expect, it } from 'vitest';
import { classifyStep, lessonStage, materialCodesIn, materialTypeForCode } from '../src/mapping.js';
import { leadCharacterFor } from '../src/write-unit.js';

describe('classifyStep', () => {
  it.each([
    ['CH2 I Can Jump!', 'CHANT', 'CH2'],
    ["NEW song: SG1 Hello, What's Your Name?", 'SONG', 'SG1'],
    ["NEW Move & Do: MD1 Let's Move", 'MOVE_AND_DO', 'MD1'],
    ['Sound Trail: m /m/ + s /s/', 'SOUND_TRAIL', 'SN'],
    ['Talk Scene: Ant Hill School', 'TALK_SCENE', null],
    ['Hello Circle – first lesson!', 'HELLO_CIRCLE', null],
    ['Ant Wiggle (march / tiptoe / freeze)', 'ANT_WIGGLE', null],
    ['ANT HILL PARTY', 'PARTY', null],
    ['Show & Share stations', 'SHOW_AND_SHARE', null],
    ['Checkpoint (quick observation)', 'CHECKPOINT', null],
    ['Book cover talk', 'OTHER', null],
  ])('%s', (title, kind, materialCode) => {
    expect(classifyStep(title)).toEqual({ kind, materialCode });
  });
});

describe('codes and stages', () => {
  it('maps material code prefixes to types', () => {
    expect(materialTypeForCode('BB2')).toBe('BOOK');
    expect(materialTypeForCode('HH')).toBe('HOME_HILL');
    expect(materialTypeForCode('LP')).toBe('OTHER');
  });

  it('finds material codes in free text', () => {
    expect(materialCodesIn('SG1 Hello + CH1 How Are You? (SG1 again)')).toEqual(['SG1', 'CH1']);
  });

  it('parses lesson stages', () => {
    expect(lessonStage('Say it myself')).toBe('SAY_IT_MYSELF');
    expect(lessonStage('Ant Hill Party')).toBe('PARTY');
    expect(lessonStage('Show & Share')).toBe('SHOW_AND_SHARE');
  });
});

describe('leadCharacterFor', () => {
  const characters = [
    { code: 'CHAR_02', name: 'Tiny Ant' },
    { code: 'CHAR_12', name: 'Pip' },
    { code: 'CHAR_12b', name: 'Pip (butterfly)' },
    { code: 'CHAR_13', name: 'Mai' },
  ];

  it('picks the character named first', () => {
    expect(leadCharacterFor('Mai & Bao (with Tiny Ant)', characters)?.code).toBe('CHAR_13');
    expect(leadCharacterFor('Pip (caterpillar → butterfly)', characters)?.code).toBe('CHAR_12');
  });
});
