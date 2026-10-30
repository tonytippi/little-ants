import localFont from 'next/font/local';

/**
 * Baloo 2, for headings. Served from our own origin, so builds and offline use do not depend on Google Fonts:
 * the Google Fonts original (SIL Open Font License, see ../fonts/OFL-*.txt) cut down to Latin and Vietnamese.
 * One module per font, so each app loads only its own fonts.
 */

export const baloo = localFont({
  src: '../fonts/baloo2-variable.woff2',
  weight: '400 800',
  variable: '--font-baloo',
});
