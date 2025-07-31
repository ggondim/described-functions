import SuperJSON from "superjson";

/**
 * Generic interface for a cache system, following the Map class structure. Compatible with
 *  many cache libraries.
 *
 * @template T The type of value that can be stored in the cache.
 *            Defaults to AcceptableCacheValue, which can be an object, array of objects,
 *            or string.
 */
export interface ICache<T> {
  /**
   * Retrieves a value from the cache by its key.
   *
   * @param {string} key The key associated with the cached value.
   * @return {Promise<T>} A promise that resolves to the cached value, or null.
   */
  get: (key: string) => Promise<T>;

  /**
   * Checks if a value exists in the cache by its key.
   *
   * @param {string} key The key to check in the cache.
   * @return {Promise<boolean>} A promise that resolves to true if the key exists, false otherwise.
   */
  has: (key: string) => Promise<boolean>;

  /**
   * Sets a value in the cache with a specified key and time-to-live (TTL).
   *
   * @param {string} key The key to associate with the cached value.
   * @param {T} value The value to cache.
   * @param {number?} ttl The time-to-live for the cached value in milliseconds.
   * @return {Promise<void>} A promise that resolves when the value is set.
   */
  set: (key: string, value: T, ttl: number) => Promise<boolean>;

  /**
   * Deletes a value from the cache by its key.
   *
   * @param {string} key The key associated with the cached value to delete.
   * @return {Promise<void>} A promise that resolves when the value is deleted.
   */
  delete: (key: string) => Promise<boolean>;

  /**
   * Clears all values from the cache.
   *
   * @return {Promise<void>} A promise that resolves when the cache is cleared.
   */
  clear: () => Promise<void>;
}

/**
 * Generates a SHA-1 hash for an object.
 *
 * @return {string} The SHA-1 hash of the object as a hexadecimal string.
 * @throws {Error} If the environment does not support the required crypto functionality.
 */

// biome-ignore lint/suspicious/noExplicitAny: cannot determine the type of obj
export async function hashObjectSHA1(obj: any) {
  const input = SuperJSON.stringify(obj);
  // TODO: extend superjson with Buffer, Uint8Array, and BSON types

  // Node.js environment
  if (typeof window === 'undefined' && typeof require === 'function') {
    const crypto = require('node:crypto');
    if (!crypto || !crypto.createHash) {
      throw new Error('Crypto module is not available in this environment.');
    }
    return crypto.createHash('sha1').update(input).digest('hex');
  }

  // Browser environment using Web Crypto API
  if (TextEncoder === undefined || crypto === undefined || !crypto.subtle) {
    throw new Error('Web Crypto API is not available in this environment.');
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const buffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
