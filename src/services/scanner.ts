/**
 * Plan scanner service
 * Discovers and reads plan files from the Claude plans directory
 */

import { stat } from "node:fs/promises";
import { file, Glob } from "bun";
import type { PlanFile } from "../types/index.ts";
import { DEFAULT_CONFIG } from "../types/index.ts";
import { calculateChecksum } from "../utils/checksum.ts";

export class ScannerService {
  private plansDir: string;

  constructor(plansDir: string = DEFAULT_CONFIG.plansDirectory) {
    this.plansDir = plansDir;
  }

  /**
   * Scan the plans directory for all markdown files
   */
  async scan(): Promise<PlanFile[]> {
    const glob = new Glob("*.md");
    const plans: PlanFile[] = [];

    for await (const filename of glob.scan(this.plansDir)) {
      const path = `${this.plansDir}/${filename}`;
      try {
        const stats = await stat(path);
        const checksum = await calculateChecksum(path);

        plans.push({
          path,
          filename,
          checksum,
          modifiedAt: stats.mtime,
          sizeBytes: stats.size,
        });
      } catch {
        // Skip files that can't be read (permissions, deleted mid-scan, etc.)
        continue;
      }
    }

    // Sort by modification date, newest first
    plans.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

    return plans;
  }

  /**
   * Read the content of a plan file
   */
  async readContent(
    planPath: string,
    maxLength?: number
  ): Promise<string> {
    const fileHandle = file(planPath);
    const content = await fileHandle.text();

    if (maxLength && content.length > maxLength) {
      return content.slice(0, maxLength) + "\n\n[... truncated for analysis]";
    }

    return content;
  }

  /**
   * Check if a specific plan file exists
   */
  async exists(filename: string): Promise<boolean> {
    const path = `${this.plansDir}/${filename}`;
    const fileHandle = file(path);
    return fileHandle.exists();
  }

  /**
   * Get the full path for a plan file
   */
  getPath(filename: string): string {
    return `${this.plansDir}/${filename}`;
  }

  /**
   * Get the plans directory path
   */
  getPlansDir(): string {
    return this.plansDir;
  }

  /**
   * Find a plan by partial name match (for user convenience)
   * Returns all matches sorted by relevance
   */
  async findByName(query: string): Promise<PlanFile[]> {
    const plans = await this.scan();
    const lowerQuery = query.toLowerCase();

    // Filter plans that contain the query
    const matches = plans.filter((p) =>
      p.filename.toLowerCase().includes(lowerQuery)
    );

    // Sort by: exact match first, then starts-with, then contains
    matches.sort((a, b) => {
      const aLower = a.filename.toLowerCase();
      const bLower = b.filename.toLowerCase();

      const aExact = aLower === lowerQuery + ".md";
      const bExact = bLower === lowerQuery + ".md";
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const aStarts = aLower.startsWith(lowerQuery);
      const bStarts = bLower.startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return 0;
    });

    return matches;
  }
}
