export type AcceptableCacheValue = object | object[] | string | null;

/**
 * Generic interface for a cache system.
 *
 * @export
 * @interface ICache
 * @template T The type of value that can be stored in the cache.
 *            Defaults to AcceptableCacheValue, which can be an object, array of objects,
 *            or string.
 */
export interface ICache<T = AcceptableCacheValue> {
  /**
   * Retrieves a value from the cache by its key.
   *
   * @memberof ICache
   * @param {string} key The key associated with the cached value.
   * @return {Promise<T>} A promise that resolves to the cached value, or null.
   */
  get: (key: string) => Promise<T>;

  /**
   * Sets a value in the cache with a specified key and time-to-live (TTL).
   *
   * @memberof ICache
   * @param {string} key The key to associate with the cached value.
   * @param {T} value The value to cache.
   * @param {number?} ttl The time-to-live for the cached value in milliseconds.
   * @return {Promise<void>} A promise that resolves when the value is set.
   */
  set: (key: string, value: T, ttl: number) => Promise<void>;

  /**
   * Deletes a value from the cache by its key.
   *
   * @memberof ICache
   * @param {string} key The key associated with the cached value to delete.
   * @return {Promise<void>} A promise that resolves when the value is deleted.
   */
  delete: (key: string) => Promise<void>;

  /**
   * Indicates whether the cache should stringify objects before storing them.
   *
   * @type {boolean}
   * @memberof ICache
   */
  stringify: boolean;
}

/**
 * Generates a SHA-1 hash for an object.
 *
 * @export
 * @param {AcceptableCacheValue} obj The object to hash.
 * @return {string} The SHA-1 hash of the object as a hexadecimal string.
 * @throws {Error} If the environment does not support the required crypto functionality.
 */
export async function hashObjectSHA1(obj: AcceptableCacheValue) {
  const input = JSON.stringify(obj);

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

type MemoryCacheValue = { value: string; expiresAt: number };

export class MemoryCache implements ICache {
  stringify: boolean;

  constructor() {
    this.stringify = true;
  }

  private get cache(): Map<string, MemoryCacheValue> {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const globalVar: any = typeof window === 'undefined' ? global : window;
    if (!globalVar._memoryCache) {
      globalVar._memoryCache = new Map<string, MemoryCacheValue>();
    }
    return globalVar._memoryCache;
  }

  async get(key: string): Promise<AcceptableCacheValue> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return JSON.parse(cached.value as unknown as string);
    }
    return null;
  }

  async set(key: string, value: AcceptableCacheValue, ttl: number): Promise<void> {
    this.cache.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + ttl,
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
}