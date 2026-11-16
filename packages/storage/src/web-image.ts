import sharp from 'sharp';

/** Teaching screens are mostly Full HD, so no picture needs a longer edge than this. */
export const MAX_IMAGE_EDGE = 1920;

/** Format every picture is stored and served in. */
export const WEB_IMAGE_MIME_TYPE = 'image/webp';

const WEBP_QUALITY = 80;
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function isWebImageSource(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType);
}

export interface WebImage {
  body: Buffer;
  mimeType: typeof WEB_IMAGE_MIME_TYPE;
  fileName: string;
}

/**
 * Convert a picture to a WebP no larger than MAX_IMAGE_EDGE on either side (never enlarged), turned upright
 * from its EXIF orientation and without metadata. Transparency is kept. Throws when the bytes are not an image.
 */
export async function toWebImage(body: Uint8Array, fileName: string): Promise<WebImage> {
  const converted = await sharp(body, { failOn: 'error' })
    .rotate()
    .resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 5 })
    .toBuffer();
  return { body: converted, mimeType: WEB_IMAGE_MIME_TYPE, fileName: webImageFileName(fileName) };
}

/** "Poster.PNG" → "Poster.webp" */
export function webImageFileName(fileName: string): string {
  return `${fileName.replace(/\.(png|jpe?g|webp)$/i, '')}.webp`;
}
