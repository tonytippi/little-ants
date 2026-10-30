import localFont from 'next/font/local';

/**
 * Poppins, for the student app's body text. Served from our own origin, so builds and offline use do not depend
 * on Google Fonts: the Google Fonts original (SIL Open Font License, see ../fonts/OFL-*.txt) cut down to Latin
 * and Vietnamese. One module per font, so each app loads only its own fonts.
 */

export const poppins = localFont({
  src: [
    { path: '../fonts/poppins-400.woff2', weight: '400' },
    { path: '../fonts/poppins-500.woff2', weight: '500' },
    { path: '../fonts/poppins-600.woff2', weight: '600' },
    { path: '../fonts/poppins-700.woff2', weight: '700' },
  ],
  variable: '--font-poppins',
});
