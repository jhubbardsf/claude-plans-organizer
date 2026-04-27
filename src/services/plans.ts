/**
 * Plan service - orchestrates scanning, caching, and analysis
 */

import chalk from "chalk";
import ora from "ora";
import type { PlanMetadata, PlanFile, ListOptions, Result } from "../types/index.ts";
import { ok, err, DEFAULT_CONFIG } from "../types/index.ts";
import { CacheService } from "./cache.ts";
import { ScannerService } from "./scanner.ts";
import { AnalyzerService } from "./analyzer.ts";
import { resolveProject } from "./project-resolver.ts";
import { truncate } from "../utils/display.ts";
import { createPool } from "../utils/concurrency.ts";

export class PlanService {
  private cache: CacheService;
  private scanner: ScannerService;
  private analyzer: AnalyzerService;

  constructor(
    plansDir: string = DEFAULT_CONFIG.plansDirectory,
    cacheDir: string = DEFAULT_CONFIG.cacheDirectory
  ) {
    this.cache = new CacheService(cacheDir);
    this.scanner = new ScannerService(plansDir);
    this.analyzer = new AnalyzerService(this.scanner);
  }

  /**
   * Get all plans with metadata, analyzing new/changed files as needed
   */
  async getAllPlans(options: Partial<ListOptions> = {}): Promise<PlanMetadata[]> {
    const spinner = ora("Scanning plans...").start();

    try {
      // Scan for all plan files
      const planFiles = await this.scanner.scan();
      spinner.succeed(`Found ${planFiles.length} plan files`);

      // Check which files need analysis
      const toAnalyze: typeof planFiles = [];
      const cached: PlanMetadata[] = [];

      for (const planFile of planFiles) {
        const isValid = await this.cache.isValid(planFile.filename, planFile.checksum);
        if (isValid) {
          const cachedMeta = await this.cache.get(planFile.filename);
          if (cachedMeta) {
            cached.push(cachedMeta);
          }
        } else {
          toAnalyze.push(planFile);
        }
      }

      // Prune cache of deleted files
      const existingFilenames = new Set(planFiles.map((p) => p.filename));
      await this.cache.prune(existingFilenames);

      // Analyze new/changed files with parallel processing
      if (toAnalyze.length > 0) {
        const concurrency = options.concurrency || DEFAULT_CONFIG.concurrency;
        console.log(chalk.dim(`\nAnalyzing ${toAnalyze.length} new/changed files with Claude (${concurrency} parallel)...\n`));

        const pool = createPool(concurrency);
        let completed = 0;

        const analyzeOne = async (planFile: PlanFile): Promise<PlanMetadata> => {
          const result = await pool.run(() => this.analyzer.analyze(planFile));
          completed++;

          // Print progress as each completes
          const progress = chalk.dim(`[${completed}/${toAnalyze.length}]`);
          const filename = chalk.dim(truncate(planFile.filename, 35));

          if (result.success) {
            await this.cache.set(result.data);
            console.log(`  ${progress} ${filename} ${chalk.green("✓")} ${result.data.title}`);
            return result.data;
          } else {
            const fallback = this.createFallback(planFile);
            await this.cache.set(fallback);
            console.log(`  ${progress} ${filename} ${chalk.yellow("⚠")} ${chalk.dim("(using filename)")}`);
            return fallback;
          }
        };

        const results = await Promise.all(toAnalyze.map(analyzeOne));
        cached.push(...results);
        console.log(""); // Empty line after analysis
      }

      console.log(chalk.green("✓") + ` Loaded ${cached.length} plans\n`);

      // Apply sorting
      return this.sortPlans(cached, options);
    } catch (error) {
      spinner.fail("Failed to load plans");
      throw error;
    }
  }

  /**
   * Get a single plan by filename or partial match
   */
  async getPlan(query: string): Promise<Result<PlanMetadata, string>> {
    const allPlans = await this.getAllPlans();

    // Try exact match first
    const exactMatch = allPlans.find(
      (p) => p.filename === query || p.filename === query + ".md"
    );
    if (exactMatch) {
      return ok(exactMatch);
    }

    // Try partial match
    const lowerQuery = query.toLowerCase();
    const matches = allPlans.filter(
      (p) =>
        p.filename.toLowerCase().includes(lowerQuery) ||
        p.title.toLowerCase().includes(lowerQuery)
    );

    if (matches.length === 0) {
      return err(`No plan found matching "${query}"`);
    }

    if (matches.length === 1) {
      return ok(matches[0]!);
    }

    // Multiple matches - return first with a note
    return ok(matches[0]!);
  }

  /**
   * Get the content of a plan file
   */
  async getContent(filename: string): Promise<Result<string, string>> {
    const path = this.scanner.getPath(filename);
    try {
      const content = await this.scanner.readContent(path);
      return ok(content);
    } catch {
      return err(`Failed to read plan file: ${filename}`);
    }
  }

  /**
   * Force refresh analysis for all or specific plans
   */
  async refresh(filename?: string): Promise<number> {
    if (filename) {
      await this.cache.remove(filename);
      return 1;
    } else {
      await this.cache.clear();
      const stats = await this.cache.getStats();
      return stats.totalEntries;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalPlans: number;
    cachedPlans: number;
    cacheFile: string;
    lastUpdated: string | null;
    plansDirectory: string;
  }> {
    const planFiles = await this.scanner.scan();
    const cacheStats = await this.cache.getStats();

    return {
      totalPlans: planFiles.length,
      cachedPlans: cacheStats.totalEntries,
      cacheFile: cacheStats.cacheFile,
      lastUpdated: cacheStats.lastUpdated,
      plansDirectory: this.scanner.getPlansDir(),
    };
  }

  /**
   * Resolve projects for all cached plans that don't have one
   * This is a slow operation that scans session files
   */
  async resolveAllProjects(): Promise<number> {
    const allCached = await this.cache.getAll();
    const needsResolution = allCached.filter((p) => p.project === null);

    if (needsResolution.length === 0) {
      return 0;
    }

    const concurrency = DEFAULT_CONFIG.concurrency;
    console.log(chalk.dim(`\nResolving projects for ${needsResolution.length} plans (${concurrency} parallel)...\n`));

    const pool = createPool(concurrency);
    let completed = 0;
    let resolved = 0;

    const resolveOne = async (plan: PlanMetadata): Promise<void> => {
      const project = await pool.run(() => resolveProject(plan.filename));
      completed++;

      const progress = chalk.dim(`[${completed}/${needsResolution.length}]`);

      if (project) {
        plan.project = project;
        await this.cache.set(plan);
        resolved++;
        console.log(`  ${progress} ${truncate(plan.title, 40)} ${chalk.green("✓")} ${chalk.magenta(this.shortProjectName(project))}`);
      } else {
        console.log(`  ${progress} ${truncate(plan.title, 40)} ${chalk.dim("· not found")}`);
      }
    };

    await Promise.all(needsResolution.map(resolveOne));
    console.log("");
    return resolved;
  }

  /**
   * Get short project name from full path
   */
  private shortProjectName(projectPath: string): string {
    const parts = projectPath.split("/").filter(Boolean);
    return parts.slice(-2).join("/");
  }

  /**
   * Get the plans directory path
   */
  getPlansDir(): string {
    return this.scanner.getPlansDir();
  }

  /**
   * Get the full path for a plan file
   */
  getPlanPath(filename: string): string {
    return this.scanner.getPath(filename);
  }

  private sortPlans(
    plans: PlanMetadata[],
    options: Partial<ListOptions>
  ): PlanMetadata[] {
    const sortBy = options.sortBy || "date";
    const reverse = options.reverse || false;

    const sorted = [...plans];

    switch (sortBy) {
      case "name":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "size":
        sorted.sort((a, b) => b.sizeBytes - a.sizeBytes);
        break;
      case "date":
      default:
        sorted.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
    }

    if (reverse) {
      sorted.reverse();
    }

    // Apply tag filter
    if (options.tag) {
      const tagLower = options.tag.toLowerCase();
      return sorted.filter((p) =>
        p.tags.some((t) => t.toLowerCase() === tagLower)
      );
    }

    // Apply limit
    if (options.limit && options.limit > 0) {
      return sorted.slice(0, options.limit);
    }

    return sorted;
  }

  private titleFromFilename(filename: string): string {
    return filename
      .replace(/\.md$/, "")
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private createFallback(planFile: PlanFile): PlanMetadata {
    return {
      filename: planFile.filename,
      checksum: planFile.checksum,
      title: this.titleFromFilename(planFile.filename),
      description: "Analysis failed - using filename",
      tags: ["uncategorized"],
      project: null,
      analyzedAt: new Date(),
      modifiedAt: planFile.modifiedAt,
      sizeBytes: planFile.sizeBytes,
    };
  }
}
