import localFont from 'next/font/local';

/**
 * Andika, for text children read. Served from our own origin, so builds and offline use do not depend on Google
 * Fonts: the Google Fonts original (SIL Open Font License, see ../fonts/OFL-*.txt) cut down to Latin and
 * Vietnamese. One module per font, so each app loads only its own fonts.
 */

export const andika = localFont({
  src: [
    { path: '../fonts/andika-400.woff2', weight: '400' },
    { path: '../fonts/andika-700.woff2', weight: '700' },
  ],
  variable: '--font-andika',
});
