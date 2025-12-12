/**
 * Type definitions for Claude Plans Organizer
 */

/** Raw file information from the filesystem */
export interface PlanFile {
  path: string;
  filename: string;
  checksum: string;
  modifiedAt: Date;
  sizeBytes: number;
}

/** Enriched plan metadata with Claude-generated title and description */
export interface PlanMetadata {
  filename: string;
  checksum: string;
  title: string;
  description: string;
  tags: string[];
  project: string | null; // Project directory where plan was created
  analyzedAt: Date;
  modifiedAt: Date;
  sizeBytes: number;
}

/** Claude's analysis response */
export interface AnalysisResult {
  title: string;
  description: string;
  tags: string[];
}

/** Type guard for AnalysisResult */
export function isAnalysisResult(data: unknown): data is AnalysisResult {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.title === "string" &&
    typeof obj.description === "string" &&
    Array.isArray(obj.tags) &&
    obj.tags.every((t) => typeof t === "string")
  );
}

/** Cache structure persisted to disk */
export interface Cache {
  version: number;
  entries: Record<string, PlanMetadata>;
  lastUpdated: string;
}

/** Type guard for Cache */
export function isCache(data: unknown): data is Cache {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.version === "number" &&
    typeof obj.entries === "object" &&
    obj.entries !== null &&
    typeof obj.lastUpdated === "string"
  );
}

/** Application configuration */
export interface Config {
  plansDirectory: string;
  cacheDirectory: string;
  claudeCommand: string;
  editor: string;
  maxContentLength: number;
  analysisDelayMs: number;
}

/** Default configuration values */
export const DEFAULT_CONFIG: Config = {
  plansDirectory: `${process.env.HOME}/.claude/plans`,
  cacheDirectory: `${process.env.HOME}/.cache/claude-plans-organizer`,
  claudeCommand: "claude-d",
  editor: process.env.EDITOR || "vim",
  maxContentLength: 4000,
  analysisDelayMs: 300,
};

/** List command options */
export interface ListOptions {
  sortBy: "date" | "name" | "size";
  reverse: boolean;
  limit?: number;
  tag?: string;
  json?: boolean;
  resolveProjects?: boolean;
}

/** Actions available after selecting a plan */
export type PlanAction = "view" | "copy" | "export" | "edit" | "back";

/** Result of an operation that can fail gracefully */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/** Helper to create success result */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/** Helper to create error result */
export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}
