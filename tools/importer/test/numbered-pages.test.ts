import { describe, expect, it } from 'vitest';
import { numberedPages } from '../src/parse-unit.js';

describe('numberedPages', () => {
  it('splits "1. …" story text into pages, keeping continuation lines with their page', () => {
    const text = [
      'Story for Busy Ants',
      "1. Annie Ant has a big basket. 'Let's go to the garden!'",
      '2. She sees a red apple.',
      "   'Apple, in you go!'",
      '',
      '10. The end.',
    ].join('\n');
    expect(numberedPages(text)).toEqual([
      { number: 1, text: "Annie Ant has a big basket. 'Let's go to the garden!'" },
      { number: 2, text: "She sees a red apple.\n'Apple, in you go!'" },
      { number: 10, text: 'The end.' },
    ]);
  });

  it('finds no pages in text without numbered lines', () => {
    expect(numberedPages('Apple, apple, red and round.\n1.5 kg of apples')).toEqual([]);
  });
});
