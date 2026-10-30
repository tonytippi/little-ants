import localFont from 'next/font/local';

/**
 * Nunito, for body text. Served from our own origin, so builds and offline use do not depend on Google Fonts:
 * the Google Fonts original (SIL Open Font License, see ../fonts/OFL-*.txt) cut down to Latin and Vietnamese.
 * One module per font, so each app loads only its own fonts.
 */

export const nunito = localFont({
  src: '../fonts/nunito-variable.woff2',
  weight: '200 1000',
  variable: '--font-nunito',
});
