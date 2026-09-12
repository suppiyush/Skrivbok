/**
 * Direct-to-storage image uploads.
 *
 * The image never touches this server. The client asks for a short-lived
 * signature, uploads straight to the storage provider with it, and sends back
 * only the resulting URL. That keeps multi-megabyte bodies off the API process
 * — which matters here, because the JSON body limit is 1MB and raising it for
 * one endpoint would raise it for every endpoint.
 *
 * Cloudinary is the provider because its signed upload is a SHA-1 over the
 * parameters and needs no SDK: about twenty lines of `node:crypto` against a
 * dependency that would otherwise pull in the whole AWS client.
 *
 * Uploads are **optional**, like mail and billing. With no credentials the
 * feature reports itself as disabled and the UI hides the control, rather than
 * offering a button that fails on click.
 */
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { FeatureDisabledError } from '../../utils/errors.js';

/** What the client needs to POST directly to the provider. */
export interface UploadSignature {
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  /** Applied by the provider on receipt, so an oversized image is normalised
   *  rather than rejected — and never stored at its original size. Absent for
   *  audio, which is kept as recorded. */
  transformation?: string;
  /** Present when the object's id is chosen per upload rather than fixed. */
  publicId?: string;
}

export function isUploadEnabled(): boolean {
  return env.uploads.enabled;
}

/**
 * Sign an avatar upload for one user.
 *
 * The folder is derived from the user id rather than taken from the client, so
 * a caller cannot sign an upload into somebody else's folder. The signature
 * covers every parameter the provider will receive; changing any of them
 * client-side invalidates it.
 */
export function signAvatarUpload(userId: string): UploadSignature {
  const config = env.uploads;
  if (!config.enabled) {
    throw new FeatureDisabledError('Image upload');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `skrivbok/avatars/${userId}`;
  // Square, face-aware, capped at 512px and re-encoded — an avatar is never
  // stored at whatever size the user happened to have.
  const transformation = 'c_fill,g_face,h_512,w_512,q_auto,f_auto';

  // Cloudinary's rule: every signed parameter, sorted by key, joined as
  // `k=v` with `&`, then the API secret appended, then SHA-1.
  const signed: Record<string, string | number> = {
    folder,
    // One image per user: uploading again replaces the previous avatar rather
    // than accumulating orphans nothing will ever delete.
    overwrite: 'true',
    public_id: 'avatar',
    timestamp,
    transformation,
  };

  const payload = Object.keys(signed)
    .sort()
    .map((key) => `${key}=${String(signed[key])}`)
    .join('&');

  const signature = createHash('sha1').update(`${payload}${config.apiSecret}`).digest('hex');

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    apiKey: config.apiKey,
    timestamp,
    signature,
    folder,
    transformation,
  };
}

/**
 * Sign a voice-note upload for one user.
 *
 * Three things differ from an avatar:
 *
 *   - The provider's `video` endpoint, which is also where it takes audio. An
 *     upload of a `.webm` clip to `image/upload` is rejected.
 *   - No `overwrite`, and a public id unique per upload. An avatar is one file
 *     a user keeps replacing; voice notes accumulate, and reusing the id would
 *     mean each new note silently destroyed the last one's audio.
 *   - No transformation. A recording is kept as recorded; re-encoding it here
 *     would cost quality for no gain the listener can hear.
 */
export function signVoiceNoteUpload(userId: string): UploadSignature {
  const config = env.uploads;
  if (!config.enabled) {
    throw new FeatureDisabledError('Voice note upload');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `skrivbok/voice-notes/${userId}`;
  // Time plus randomness: two recordings started in the same second by the
  // same person still land in different objects.
  const publicId = `note-${timestamp}-${randomBytes(6).toString('hex')}`;

  const signed: Record<string, string | number> = {
    folder,
    public_id: publicId,
    timestamp,
  };

  const payload = Object.keys(signed)
    .sort()
    .map((key) => `${key}=${String(signed[key])}`)
    .join('&');

  const signature = createHash('sha1').update(`${payload}${config.apiSecret}`).digest('hex');

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/video/upload`,
    apiKey: config.apiKey,
    timestamp,
    signature,
    folder,
    publicId,
  };
}

/**
 * Is this URL one our provider actually issued?
 *
 * The client reports the URL after uploading, and a client can report
 * anything. Without this check the avatar field becomes a way to point the
 * product's own pages at an arbitrary third-party image.
 */
export function isOwnStorageUrl(url: string): boolean {
  const config = env.uploads;
  if (!config.enabled) return false;

  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'res.cloudinary.com' &&
      parsed.pathname.startsWith(`/${config.cloudName}/`)
    );
  } catch {
    return false;
  }
}
