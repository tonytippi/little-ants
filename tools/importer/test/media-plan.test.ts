import { describe, expect, it } from 'vitest';
import { planUnitMedia, type MediaSources } from '../src/media-plan.js';

const UNIT = '/drive/Unit05_YummyGarden';
const FINAL = `${UNIT}/04_Design/FINAL`;

const sources: MediaSources = {
  unitCode: 'U05',
  draftDesigns: [],
  finalFiles: [
    `${FINAL}/U05_1_AI-Pictures/03_Word-Cards/U05-WC-02_banana.png`,
    `${FINAL}/U05_2_AI-Pictures_4K/03_Word-Cards/U05-WC-02_banana.jpg`,
    `${FINAL}/U05_2_AI-Pictures_4K/03_Word-Cards/U05-WC-23_soup.jpg`,
    `${FINAL}/U05_1_AI-Pictures/03_Word-Cards/U05-WC-39_here-you-are.png`,
    `${FINAL}/U05_1_AI-Pictures/03_Word-Cards/U05-WC-03_kiwi.png`,
    `${FINAL}/U05_1_AI-Pictures/05_Songs/U05_SG1_panel1_pick.jpg`,
    `${FINAL}/U05_2_AI-Pictures_4K/05_Songs/U05_SG1_panel1_pick.jpg`,
    `${FINAL}/U05_2_AI-Pictures_4K/05_Songs/U05_SG1_panel4_cut.jpg`,
    `${FINAL}/U05_1_AI-Pictures/04_Talk-Scene-Cover/U05_TS1_At-the-Market.jpg`,
    `${FINAL}/U05_1_AI-Pictures/04_Talk-Scene-Cover/U05_UC_Cover.jpg`,
    `${FINAL}/U05_2_AI-Pictures_4K/02_Places/U05_PLACE_market.jpg`,
    `${FINAL}/U05_2_AI-Pictures_4K/02_Places/U05_PLACE_fruit-shop.jpg`,
    `${FINAL}/U05_2_AI-Pictures_4K/04_Talk-Scene-Cover/U05_UC_Cover.jpg`,
    `${FINAL}/U05_3_Canva-Final/U05-SG-LA (42 x 29.7 cm).pdf`,
    `${FINAL}/.DS_Store`,
    `${FINAL}/U05_1_AI-Pictures/05_Songs/U05_SG1_panel2_wash.svg`,
  ],
  audio: [
    `${UNIT}/05_Audio-Video/U05_SG2_Do-You-Like-Fruits_audio_v1.0.mp3`,
    `${UNIT}/05_Audio-Video/U05_SG2_Do-You-Like-Fruits_audio_v1.1.mp3`,
    `${UNIT}/05_Audio-Video/U05_CH1_Crunch-Munch-Yum_audio_v1.0.mp3`,
    `${UNIT}/05_Audio-Video/U05_ZZ9_Unknown_audio_v1.0.mp3`,
    '/drive/00_ROUTINES-AUDIO/LA2_RT1_Hello-Little-Ants_audio_v1.0.mp3',
    '/drive/00_ROUTINES-AUDIO/LA2_RT9_Not-In-This-Unit_audio_v1.0.mp3',
  ],
  materials: ['SG1', 'SG2', 'SG3', 'CH1', 'TS1', 'RT1'].map((code) => ({ code, type: code.startsWith('SG') ? 'SONG' : 'OTHER' })),
  words: [
    { cardId: 'U05-02', text: 'banana' },
    { cardId: 'U05-03', text: 'orange' },
    { cardId: 'U05-23', text: 'soup' },
    { cardId: 'U05-39', text: 'Here you are' },
  ],
};

const name = (file: string): string => file.split('/').slice(-2).join('/');

describe('planUnitMedia', () => {
  const plan = planUnitMedia(sources);

  it('gives word cards their picture, preferring the regular copy over 4K', () => {
    expect(plan.words.map((word) => `${word.cardId} ${name(word.file)}`).sort()).toEqual([
      'U05-02 03_Word-Cards/U05-WC-02_banana.png',
      'U05-23 03_Word-Cards/U05-WC-23_soup.jpg',
      'U05-39 03_Word-Cards/U05-WC-39_here-you-are.png',
    ]);
  });

  it('links pictures in panel order, recordings (newest version) and print files', () => {
    const links = plan.links.map((link) => `${link.materialCode} ${link.role} ${link.order} ${name(link.file)}`).sort();
    expect(links).toEqual([
      'CH1 audio 0 05_Audio-Video/U05_CH1_Crunch-Munch-Yum_audio_v1.0.mp3',
      'RT1 audio 0 00_ROUTINES-AUDIO/LA2_RT1_Hello-Little-Ants_audio_v1.0.mp3',
      'SG1 poster 1 05_Songs/U05_SG1_panel1_pick.jpg',
      'SG1 poster 4 05_Songs/U05_SG1_panel4_cut.jpg',
      'SG1 print 0 U05_3_Canva-Final/U05-SG-LA (42 x 29.7 cm).pdf',
      'SG2 audio 0 05_Audio-Video/U05_SG2_Do-You-Like-Fruits_audio_v1.1.mp3',
      'SG2 print 0 U05_3_Canva-Final/U05-SG-LA (42 x 29.7 cm).pdf',
      'SG3 print 0 U05_3_Canva-Final/U05-SG-LA (42 x 29.7 cm).pdf',
      'TS1 poster 0 04_Talk-Scene-Cover/U05_TS1_At-the-Market.jpg',
    ]);
    expect(plan.links.find((link) => link.materialCode === 'SG1' && link.order === 1)?.file).not.toContain('4K');
  });

  it('takes the unit cover and the places, ordered by name', () => {
    expect(plan.pictures.map((picture) => `${picture.role} ${picture.order} "${picture.label}" ${name(picture.file)}`)).toEqual(
      expect.arrayContaining([
        'cover 0 "" 04_Talk-Scene-Cover/U05_UC_Cover.jpg',
        'place 0 "fruit shop" 02_Places/U05_PLACE_fruit-shop.jpg',
        'place 1 "market" 02_Places/U05_PLACE_market.jpg',
      ]),
    );
    expect(plan.pictures).toHaveLength(3);
    expect(plan.pictures.find((picture) => picture.role === 'cover')?.file).not.toContain('4K');
  });

  it('reports every file it leaves out, but not program audio for materials the unit does not have', () => {
    const ignored = Object.fromEntries(plan.ignored.map((item) => [name(item.file), item.reason]));
    expect(ignored).toEqual({
      '03_Word-Cards/U05-WC-02_banana.jpg': 'a lighter copy is used for word card U05-02',
      '03_Word-Cards/U05-WC-03_kiwi.png': 'word card U05-03 is "orange"',
      '05_Songs/U05_SG1_panel1_pick.jpg': 'a lighter copy is used for SG1',
      '04_Talk-Scene-Cover/U05_UC_Cover.jpg': 'a lighter copy is used for the unit cover',
      '05_Songs/U05_SG1_panel2_wash.svg': 'file type not used (pictures must be PNG or JPEG)',
      '05_Audio-Video/U05_SG2_Do-You-Like-Fruits_audio_v1.0.mp3': 'a newer version is used for SG2',
      '05_Audio-Video/U05_ZZ9_Unknown_audio_v1.0.mp3': 'no matching material',
    });
  });
});
