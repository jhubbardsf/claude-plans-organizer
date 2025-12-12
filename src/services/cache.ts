/**
 * Cache service for storing plan metadata
 * Uses file-based JSON storage with checksum validation
 */

import { mkdir } from "node:fs/promises";
import { file } from "bun";
import type { Cache, PlanMetadata } from "../types/index.ts";
import { isCache } from "../types/index.ts";
import { DEFAULT_CONFIG } from "../types/index.ts";

const CACHE_VERSION = 1;

export class CacheService {
  private cacheDir: string;
  private cacheFile: string;
  private cache: Cache | null = null;

  constructor(cacheDir: string = DEFAULT_CONFIG.cacheDirectory) {
    this.cacheDir = cacheDir;
    this.cacheFile = `${cacheDir}/metadata.json`;
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureDir(): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
  }

  /**
   * Load cache from disk, returns empty cache if not found or invalid
   */
  async load(): Promise<Cache> {
    if (this.cache) return this.cache;

    try {
      const cacheFileHandle = file(this.cacheFile);
      if (!(await cacheFileHandle.exists())) {
        this.cache = this.createEmptyCache();
        return this.cache;
      }

      const content = await cacheFileHandle.text();
      const parsed: unknown = JSON.parse(content);

      if (!isCache(parsed)) {
        console.warn("Cache file is corrupted, creating new cache");
        this.cache = this.createEmptyCache();
        return this.cache;
      }

      // Check version compatibility
      if (parsed.version !== CACHE_VERSION) {
        console.warn(
          `Cache version mismatch (${parsed.version} vs ${CACHE_VERSION}), rebuilding`
        );
        this.cache = this.createEmptyCache();
        return this.cache;
      }

      // Convert date strings back to Date objects
      for (const entry of Object.values(parsed.entries)) {
        entry.analyzedAt = new Date(entry.analyzedAt);
        entry.modifiedAt = new Date(entry.modifiedAt);
      }

      this.cache = parsed;
      return this.cache;
    } catch {
      this.cache = this.createEmptyCache();
      return this.cache;
    }
  }

  /**
   * Save cache to disk
   */
  async save(): Promise<void> {
    if (!this.cache) return;

    await this.ensureDir();
    this.cache.lastUpdated = new Date().toISOString();

    await Bun.write(this.cacheFile, JSON.stringify(this.cache, null, 2));
  }

  /**
   * Get cached metadata for a file by filename
   */
  async get(filename: string): Promise<PlanMetadata | undefined> {
    const cache = await this.load();
    return cache.entries[filename];
  }

  /**
   * Check if a file's checksum matches the cached version
   */
  async isValid(filename: string, currentChecksum: string): Promise<boolean> {
    const cached = await this.get(filename);
    return cached?.checksum === currentChecksum;
  }

  /**
   * Store metadata for a file
   */
  async set(metadata: PlanMetadata): Promise<void> {
    const cache = await this.load();
    cache.entries[metadata.filename] = metadata;
    await this.save();
  }

  /**
   * Remove a file from cache
   */
  async remove(filename: string): Promise<void> {
    const cache = await this.load();
    delete cache.entries[filename];
    await this.save();
  }

  /**
   * Get all cached entries
   */
  async getAll(): Promise<PlanMetadata[]> {
    const cache = await this.load();
    return Object.values(cache.entries);
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    this.cache = this.createEmptyCache();
    await this.save();
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    lastUpdated: string | null;
    cacheFile: string;
  }> {
    const cache = await this.load();
    return {
      totalEntries: Object.keys(cache.entries).length,
      lastUpdated: cache.lastUpdated || null,
      cacheFile: this.cacheFile,
    };
  }

  /**
   * Remove entries for files that no longer exist
   */
  async prune(existingFilenames: Set<string>): Promise<number> {
    const cache = await this.load();
    const toRemove: string[] = [];

    for (const filename of Object.keys(cache.entries)) {
      if (!existingFilenames.has(filename)) {
        toRemove.push(filename);
      }
    }

    for (const filename of toRemove) {
      delete cache.entries[filename];
    }

    if (toRemove.length > 0) {
      await this.save();
    }

    return toRemove.length;
  }

  private createEmptyCache(): Cache {
    return {
      version: CACHE_VERSION,
      entries: {},
      lastUpdated: new Date().toISOString(),
    };
  }
}
