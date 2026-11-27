import { describe, expect, it } from 'vitest';
import {
  isImagePath,
  isIngestMediaPath,
  mediaDisplayName,
  mediaFileName,
  mediaTitleFromPath,
  normalizeMediaUrl,
} from '../src/model/types';

describe('media names', () => {
  it('derives a title from a local file name without its extension', () => {
    expect(mediaTitleFromPath('/Users/boris/Pictures/Family Portrait.jpg')).toBe('Family Portrait');
    expect(mediaTitleFromPath('C:\\Photos\\Anna.png')).toBe('Anna');
    expect(mediaTitleFromPath('photos/family-1920.jpeg')).toBe('family-1920');
    expect(mediaTitleFromPath('photos/my.photo.jpg')).toBe('my.photo');
    expect(mediaTitleFromPath('photo')).toBe('photo');
  });

  it('derives a title from a URL path and ignores query and fragment', () => {
    expect(mediaTitleFromPath('https://example.com/photos/Portrait%20of%20Anna.jpg?token=1#crop')).toBe(
      'Portrait of Anna',
    );
    expect(mediaTitleFromPath('file:///Users/me/photo.png')).toBe('photo');
    expect(mediaTitleFromPath('https://example.com/')).toBe('example.com');
    expect(mediaTitleFromPath('https://example.com')).toBe('example.com');
  });

  it('has no title for an empty or malformed path', () => {
    expect(mediaTitleFromPath('')).toBeUndefined();
    expect(mediaTitleFromPath('https://')).toBeUndefined();
  });

  it('returns the display file name for local paths and URLs', () => {
    expect(mediaFileName('media/6ad7036a-820f-4bc5-8693-e158c469ba25.png')).toBe(
      '6ad7036a-820f-4bc5-8693-e158c469ba25.png',
    );
    expect(mediaFileName('C:\\Photos\\Anna.png')).toBe('Anna.png');
    expect(mediaFileName('https://example.com/photos/Portrait%20of%20Anna.jpg?token=1')).toBe('Portrait of Anna.jpg');
    expect(mediaFileName('https://example.com/')).toBe('example.com');
    expect(mediaFileName('https://')).toBeUndefined();
  });

  it('prefers a non-empty title and falls back to the file name', () => {
    expect(mediaDisplayName({ title: '  Portrait  ', path: 'media/abc.jpg' })).toBe('Portrait');
    expect(mediaDisplayName({ title: '', path: 'media/family.jpg' })).toBe('family.jpg');
    expect(mediaDisplayName({ title: undefined, path: 'https://example.com/anna.jpg' })).toBe('anna.jpg');
    expect(mediaDisplayName({ title: undefined, path: 'https://example.com/' })).toBe('example.com');
  });

  it('separates ingest formats from displayable image formats', () => {
    expect(isIngestMediaPath('photos/a.jpg')).toBe(true);
    expect(isIngestMediaPath('photos/a.JPEG')).toBe(true);
    expect(isIngestMediaPath('photos/a.avif')).toBe(true);
    expect(isIngestMediaPath('photos/a.png')).toBe(false);
    expect(isIngestMediaPath('photos/a.heic')).toBe(false);
    expect(isIngestMediaPath('photos/a')).toBe(false);

    expect(isImagePath('media/a.avif')).toBe(true);
    expect(isImagePath('media/a.bmp')).toBe(true);
    expect(isImagePath('media/a.png')).toBe(true);
    expect(isImagePath('media/a.heic')).toBe(false);
    expect(isImagePath('media/a.tiff')).toBe(false);
    expect(isImagePath('https://example.com/a.jpg?token=1')).toBe(true);
  });

  it('normalizes user-entered media links', () => {
    expect(normalizeMediaUrl('example.com/photo.jpg')).toBe('https://example.com/photo.jpg');
    expect(normalizeMediaUrl('http://example.com/photo.jpg')).toBe('http://example.com/photo.jpg');
    expect(normalizeMediaUrl('//example.com/photo.jpg')).toBe('https://example.com/photo.jpg');
    expect(normalizeMediaUrl('https://example.com/photo.jpg?size=large')).toBe(
      'https://example.com/photo.jpg?size=large',
    );
    expect(normalizeMediaUrl('ftp://example.com/photo.jpg')).toBeUndefined();
    expect(normalizeMediaUrl('file:///tmp/photo.jpg')).toBeUndefined();
    expect(normalizeMediaUrl('  ')).toBeUndefined();
  });
});
