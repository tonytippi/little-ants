import { describe, expect, it } from 'vitest';
import { parseContentTexts } from '../src/content-texts.js';

// Shaped like 10_SPEC/U05_YummyGarden/U05_Content-Texts.md (lines end in two spaces: Markdown line breaks).
const MARKDOWN = [
  '<!-- Converted from U05_Content-Texts.docx on 1 November 2026. -->',
  '',
  '# ANT HILL 5 · Yummy Garden',
  '',
  '## How to use this file',
  '',
  '- This file has every text in the unit.',
  '',
  '## Routines (every lesson)',
  '',
  '### RT1 – Hello, Little Ants!',
  '',
  '*Routine song*  ',
  'Hello, Little Ants!  ',
  "Let's sing and play today.",
  '',
  'Hello, everyone!  ',
  "Actions: Wave; open your arms on 'everyone'.",
  '',
  '### SG2 – Do You Like Fruits?',
  '',
  '*Original melody (made in Suno)*  ',
  'Do you like bananas?  ',
  'Yes, I do! **Yes**, I do!',
  '',
  'Target language: Do you like \\_\\_\\_? Yes, I do.  ',
  'Actions: Thumbs up = Yes, I do.',
  '',
  '### ST1 – Annie\'s Big Basket',
  '',
  "*8 pages, repeated line: '___, in you go!'*  ",
  "1. Annie Ant has a big basket. 'Let's go to the garden!'  ",
  "2. She sees a red apple. 'Apple, in you go!'",
  '',
  '### ST2 – Just One Taste',
  '',
  "*8 pages, repeated line: 'No, thank you!' says Tiny.*  ",
  "**Page 1:** Tiny Ant is hungry. 'I'm hungry, Grandma!'  ",
  "**Page 2:** Grandma has a carrot. 'No, thank you!' says Tiny.",
  '',
  '## Talk Scene – At the Market',
  '',
  '- L1 Point: Where are the bananas?',
  '',
  '## Sound Trails',
  '',
  '| Letter | Sound | Picture words |',
  '|---|---|---|',
  '| A a | /æ/ | ant, apple |',
].join('\n');

describe('parseContentTexts', () => {
  const entries = parseContentTexts(MARKDOWN);

  it('reads one entry per material heading and nothing from other sections', () => {
    expect([...entries.keys()]).toEqual(['RT1', 'SG2', 'ST1', 'ST2']);
  });

  it('splits the format line, the text lines and the labelled lines, without Markdown markup', () => {
    expect(entries.get('RT1')).toEqual({
      code: 'RT1',
      title: 'Hello, Little Ants!',
      format: 'Routine song',
      pages: [],
      lines: ['Hello, Little Ants!', "Let's sing and play today.", 'Hello, everyone!'],
      targetLanguage: '',
      actions: "Wave; open your arms on 'everyone'.",
    });
    expect(entries.get('SG2')).toMatchObject({
      format: 'Original melody (made in Suno)',
      lines: ['Do you like bananas?', 'Yes, I do! Yes, I do!'],
      targetLanguage: 'Do you like ___? Yes, I do.',
      actions: 'Thumbs up = Yes, I do.',
    });
  });

  it('reads "Page N:" lines as pages and keeps numbered lines as text', () => {
    expect(entries.get('ST2')).toMatchObject({
      format: "8 pages, repeated line: 'No, thank you!' says Tiny.",
      pages: [
        { number: 1, text: "Tiny Ant is hungry. 'I'm hungry, Grandma!'" },
        { number: 2, text: "Grandma has a carrot. 'No, thank you!' says Tiny." },
      ],
      lines: [],
    });
    expect(entries.get('ST1')).toMatchObject({
      title: "Annie's Big Basket",
      format: "8 pages, repeated line: '___, in you go!'",
      pages: [],
      lines: [
        "1. Annie Ant has a big basket. 'Let's go to the garden!'",
        "2. She sees a red apple. 'Apple, in you go!'",
      ],
    });
  });
});
