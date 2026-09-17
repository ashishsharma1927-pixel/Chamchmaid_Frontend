import nacl from 'tweetnacl';
import util from 'tweetnacl-util';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from './storage';
import client from '../api/client';

import { Platform } from 'react-native';

const DEFAULT_MEDIA_KEY = '4VIAQ7m0XiO67D7GK0qERpQOPtZr1bEbUnNCAbhWRCU=';
const MEDIA_KEY_STORE = 'media_encryption_key';
const CACHE_DIR = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}media_cache/` : '';

// In-memory cache for the key so we don't read SecureStore on every render
let cachedKeyBytes: Uint8Array | null = null;

// Track active decryption promises to prevent duplicate downloads of the same image
const activeDecryptions = new Map<string, Promise<string>>();

/**
 * Ensures the media cache directory exists (Native only).
 */
async function ensureCacheDirExists() {
    if (Platform.OS === 'web' || !CACHE_DIR) return;
    try {
        const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
        }
    } catch (e) {
        console.warn('Cache dir error:', e);
    }
}

/**
 * Retrieves the 32-byte media encryption key.
 * Checks memory -> SecureStore -> Server endpoint -> Default fallback.
 */
export async function getMediaKey(): Promise<Uint8Array> {
    if (cachedKeyBytes) {
        return cachedKeyBytes;
    }

    try {
        let keyB64 = await SecureStore.getItemAsync(MEDIA_KEY_STORE);
        if (!keyB64) {
            try {
                const res = await client.get('/api/media/key/');
                if (res.data?.media_key) {
                    keyB64 = res.data.media_key;
                    await SecureStore.setItemAsync(MEDIA_KEY_STORE, keyB64!);
                }
            } catch (err) {
                // If offline or network error, fallback to default
                keyB64 = DEFAULT_MEDIA_KEY;
            }
        }
        if (!keyB64) keyB64 = DEFAULT_MEDIA_KEY;

        cachedKeyBytes = util.decodeBase64(keyB64);
        return cachedKeyBytes;
    } catch (e) {
        cachedKeyBytes = util.decodeBase64(DEFAULT_MEDIA_KEY);
        return cachedKeyBytes;
    }
}

/**
 * Sets or updates the media encryption key in SecureStore and memory.
 */
export async function setMediaKey(keyB64: string) {
    if (!keyB64) return;
    await SecureStore.setItemAsync(MEDIA_KEY_STORE, keyB64);
    cachedKeyBytes = util.decodeBase64(keyB64);
}

/**
 * Checks if a given media URL is an encrypted Cloudinary post.
 */
export function isEncryptedMediaUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    return url.includes('.enc');
}

/**
 * Fetches an encrypted post image from Cloudinary, decrypts it using tweetnacl,
 * stores the decrypted JPEG in local device cache, and returns the local file URI.
 *
 * Subsequent requests for the same image will resolve instantly (0ms) from disk cache.
 */
export async function getOrDecryptMedia(url: string): Promise<string> {
    if (!url) return '';
    if (!isEncryptedMediaUrl(url)) {
        return url;
    }

    // Check if there is already an ongoing download/decryption for this URL
    if (activeDecryptions.has(url)) {
        return activeDecryptions.get(url)!;
    }

    const decryptPromise = (async () => {
        try {
            // In web browser environment, decrypt directly in memory to Blob URL
            if (Platform.OS === 'web') {
                const res = await fetch(url);
                if (!res.ok) {
                    console.warn(`[mediaCrypto] HTTP ${res.status} fetching media: ${url}`);
                    return url;
                }
                const arrayBuffer = await res.arrayBuffer();
                const rawEncryptedBytes = new Uint8Array(arrayBuffer);
                if (rawEncryptedBytes.length < 24 + 16) {
                    return url;
                }
                const nonce = rawEncryptedBytes.slice(0, 24);
                const ciphertext = rawEncryptedBytes.slice(24);
                const key = await getMediaKey();
                const decryptedBytes = nacl.secretbox.open(ciphertext, nonce, key);
                if (!decryptedBytes) {
                    console.error('Secretbox open returned null on web');
                    return url;
                }
                const blob = new Blob([decryptedBytes as any], { type: 'image/jpeg' });
                return URL.createObjectURL(blob);
            }

            await ensureCacheDirExists();

            // Extract a unique, safe filename based on the Cloudinary URL
            const rawFilename = url.split('/').pop()?.split('?')[0] || `img_${Date.now()}`;
            const cachedFilename = rawFilename.endsWith('.enc')
                ? rawFilename.replace('.enc', '.jpg')
                : `${rawFilename}.jpg`;
            const localCachePath = `${CACHE_DIR}${cachedFilename}`;

            // Check if already decrypted and cached on device
            const fileInfo = await FileSystem.getInfoAsync(localCachePath);
            if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
                return localCachePath;
            }

            // Download encrypted file (.enc) to a temporary file
            const tempEncPath = `${FileSystem.cacheDirectory}temp_${Date.now()}_${rawFilename}`;
            const downloadResult = await FileSystem.downloadAsync(url, tempEncPath);
            if (downloadResult.status !== 200) {
                throw new Error(`Failed to download encrypted media with status ${downloadResult.status}`);
            }

            // Read raw encrypted bytes as Base64
            const encBase64 = await FileSystem.readAsStringAsync(tempEncPath, {
                encoding: FileSystem.EncodingType.Base64,
            });
            await FileSystem.deleteAsync(tempEncPath, { idempotent: true });

            const rawEncryptedBytes = util.decodeBase64(encBase64);
            if (rawEncryptedBytes.length < 24 + 16) {
                throw new Error('Encrypted payload too short');
            }

            // Extract 24-byte Nonce and Ciphertext
            const nonce = rawEncryptedBytes.slice(0, 24);
            const ciphertext = rawEncryptedBytes.slice(24);

            const key = await getMediaKey();
            const decryptedBytes = nacl.secretbox.open(ciphertext, nonce, key);

            if (!decryptedBytes) {
                console.error('Failed to decrypt image: SecretBox open returned null');
                return url; // fallback to original url if decryption fails
            }

            // Write decrypted JPEG bytes to local disk cache
            const decryptedBase64 = util.encodeBase64(decryptedBytes);
            await FileSystem.writeAsStringAsync(localCachePath, decryptedBase64, {
                encoding: FileSystem.EncodingType.Base64,
            });

            return localCachePath;
        } catch (error) {
            console.error('Error decrypting media post:', error);
            return url;
        } finally {
            activeDecryptions.delete(url);
        }
    })();

    activeDecryptions.set(url, decryptPromise);
    return decryptPromise;
}
