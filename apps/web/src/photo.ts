import type { PhotoMeta } from './types';

// The largest edge, in pixels, we keep when re-encoding an upload. Family
// photos rarely need more, and downscaling keeps the database small.
const MAX_EDGE = 1400;
const JPEG_QUALITY = 0.85;

export type PreparedPhoto = { data: string; contentType: 'image/jpeg' };

// The URL that serves a photo's bytes. Used directly as an <img> src.
export const photoUrl = (photo: Pick<PhotoMeta, 'id'>) => `/api/photos/${photo.id}`;

// The person's profile photo (first primary), if any.
export const primaryPhoto = (photos: PhotoMeta[]) =>
  photos.find((photo) => photo.isPrimary) ?? photos[0];

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    image.src = url;
  });

// Downscale and re-encode a chosen file to a base64 JPEG the API can store.
// Doing this in the browser keeps uploads small and normalises formats (HEIC
// from phones included, once the browser can decode it).
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not process that image.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
  if (!data) throw new Error('Your browser could not process that image.');
  return { data, contentType: 'image/jpeg' };
}
