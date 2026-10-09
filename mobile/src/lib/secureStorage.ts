/**
 * Session storage adapter for Supabase backed by the OS keychain/keystore.
 *
 * A Supabase session (access token + refresh token + user object) regularly
 * exceeds the ~2 KB value limit SecureStore documents, which can make the write
 * fail or truncate. Values are therefore split into fixed-size chunks.
 *
 * Layout for a key `k`:
 *   k        -> `chunks:<N>` marker (or a legacy un-chunked value)
 *   k.0 ...  -> the N chunks
 *
 * Reads still return legacy single-value sessions so existing installs stay
 * signed in after upgrading.
 */
import * as SecureStore from 'expo-secure-store';

export const SECURE_CHUNK_SIZE = 1800;
const CHUNK_MARKER = 'chunks:';

const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function chunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

async function removeChunks(key: string, count: number): Promise<void> {
  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, index)),
    ),
  );
}

async function readChunkCount(key: string): Promise<number | null> {
  const head = await SecureStore.getItemAsync(key);
  if (head?.startsWith(CHUNK_MARKER)) {
    const count = Number(head.slice(CHUNK_MARKER.length));
    return Number.isInteger(count) && count > 0 ? count : null;
  }
  return null;
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const head = await SecureStore.getItemAsync(key);
    if (head === null || head === undefined) return null;
    if (!head.startsWith(CHUNK_MARKER)) return head; // legacy single value

    const count = Number(head.slice(CHUNK_MARKER.length));
    if (!Number.isInteger(count) || count <= 0) return null;

    const parts = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, index)),
      ),
    );
    // A missing chunk means a torn write; treat as signed out rather than
    // handing Supabase a corrupt JSON string.
    if (parts.some(part => part === null || part === undefined)) return null;
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousCount = await readChunkCount(key);

    const chunks: string[] = [];
    for (let offset = 0; offset < value.length; offset += SECURE_CHUNK_SIZE) {
      chunks.push(value.slice(offset, offset + SECURE_CHUNK_SIZE));
    }

    // Write the chunks first and the marker last, so a crash mid-write leaves
    // the previous marker (and a readable previous value) in place.
    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, index), chunk, STORE_OPTIONS),
      ),
    );
    await SecureStore.setItemAsync(key, `${CHUNK_MARKER}${chunks.length}`, STORE_OPTIONS);

    if (previousCount && previousCount > chunks.length) {
      await Promise.all(
        Array.from({ length: previousCount - chunks.length }, (_, index) =>
          SecureStore.deleteItemAsync(chunkKey(key, chunks.length + index)),
        ),
      );
    }
  },

  async removeItem(key: string): Promise<void> {
    const count = await readChunkCount(key);
    if (count) await removeChunks(key, count);
    await SecureStore.deleteItemAsync(key);
  },
};
