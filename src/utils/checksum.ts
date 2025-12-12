/**
 * File checksum utilities using Bun's native crypto
 */

import { file } from "bun";

/**
 * Calculate SHA-256 checksum of a file's contents
 * Uses Bun's native hasher for optimal performance
 */
export async function calculateChecksum(filePath: string): Promise<string> {
  const fileHandle = file(filePath);
  const content = await fileHandle.arrayBuffer();
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  return hasher.digest("hex");
}

/**
 * Calculate checksum from string content directly
 * Useful for testing or in-memory operations
 */
export function checksumFromString(content: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  return hasher.digest("hex");
}
