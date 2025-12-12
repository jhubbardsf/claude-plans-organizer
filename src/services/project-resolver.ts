/**
 * Project resolver service
 * Determines which project directory a plan was created in by searching session files
 *
 * Uses a grep-first strategy: find candidate files with grep, then parse only those
 */

import { createInterface } from "readline";
import { createReadStream } from "fs";

const PROJECTS_DIR = `${process.env.HOME}/.claude/projects`;

interface SessionLine {
  cwd?: string;
  message?: {
    content?: Array<{
      type: string;
      name?: string;
      input?: {
        file_path?: string;
      };
    }>;
  };
}

/**
 * Cache of plan filename -> project path mappings
 */
const projectCache = new Map<string, string | null>();

/**
 * Find session files that contain a specific pattern using grep
 * Returns list of file paths
 */
async function findSessionsWithPattern(pattern: string): Promise<string[]> {
  try {
    const proc = Bun.spawn(["grep", "-l", "-r", pattern, PROJECTS_DIR], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    return output
      .trim()
      .split("\n")
      .filter((line) => line.endsWith(".jsonl"));
  } catch {
    return [];
  }
}

/**
 * Find the project directory where a plan was created
 * Searches session files for Write operations to the plan file
 */
export async function resolveProject(planFilename: string): Promise<string | null> {
  // Check cache first
  if (projectCache.has(planFilename)) {
    return projectCache.get(planFilename) ?? null;
  }

  const planPath = `${process.env.HOME}/.claude/plans/${planFilename}`;

  // Fast grep to find candidate session files
  const candidates = await findSessionsWithPattern(planFilename);

  // Parse only candidate files
  for (const sessionPath of candidates) {
    try {
      const cwd = await searchSessionForPlanCreation(sessionPath, planPath);
      if (cwd) {
        projectCache.set(planFilename, cwd);
        return cwd;
      }
    } catch {
      continue;
    }
  }

  projectCache.set(planFilename, null);
  return null;
}

/**
 * Search a session file for the creation of a plan
 * Returns the cwd if found
 */
async function searchSessionForPlanCreation(
  sessionPath: string,
  planPath: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const stream = createReadStream(sessionPath, { encoding: "utf-8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    let lastCwd: string | null = null;
    let resolved = false;

    rl.on("line", (line) => {
      if (resolved) return;

      try {
        const parsed = JSON.parse(line) as SessionLine;

        // Track the cwd from each line
        if (parsed.cwd) {
          lastCwd = parsed.cwd;
        }

        // Look for Write tool calls to this plan path
        const content = parsed.message?.content;
        if (Array.isArray(content)) {
          for (const item of content) {
            if (
              item.type === "tool_use" &&
              item.name === "Write" &&
              item.input?.file_path === planPath
            ) {
              resolved = true;
              rl.close();
              stream.destroy();
              resolve(lastCwd);
              return;
            }
          }
        }
      } catch {
        // Skip malformed lines
      }
    });

    rl.on("close", () => {
      if (!resolved) resolve(null);
    });
    rl.on("error", () => {
      if (!resolved) resolve(null);
    });
  });
}

/**
 * Decode a project directory name back to a path
 * e.g., "-Users-josh-Engineering" -> "/Users/josh/Engineering"
 */
function decodeProjectPath(encoded: string): string {
  return encoded.replace(/^-/, "/").replace(/-/g, "/");
}

/**
 * Get a short project name from a full path
 * e.g., "/Users/josh/Engineering/my-project" -> "my-project"
 */
export function getProjectName(projectPath: string | null): string {
  if (!projectPath) return "unknown";

  // Get the last meaningful directory name
  const parts = projectPath.split("/").filter(Boolean);

  // Skip common prefixes like "Users", "josh", "Engineering"
  const meaningfulParts = parts.slice(-2); // Last 2 parts usually most meaningful

  return meaningfulParts.join("/");
}

/**
 * Batch resolve projects for multiple plans
 * Uses grep to find all candidate files first, then parses them
 */
export async function resolveProjects(
  planFilenames: string[]
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  // Build a map of plan paths to filenames
  const planPaths = new Map<string, string>();
  for (const filename of planFilenames) {
    const planPath = `${process.env.HOME}/.claude/plans/${filename}`;
    planPaths.set(planPath, filename);
  }

  // Find all session files containing any of the plan filenames
  // Use grep with OR pattern: "file1\|file2\|file3"
  const pattern = planFilenames.join("\\|");
  const candidates = await findSessionsWithPattern(pattern);

  // Parse only candidate files
  for (const sessionPath of candidates) {
    try {
      const found = await searchSessionForMultiplePlans(sessionPath, planPaths);
      for (const [filename, cwd] of found) {
        if (!results.has(filename)) {
          results.set(filename, cwd);
          projectCache.set(filename, cwd);
        }
      }
    } catch {
      continue;
    }

    // Early exit if we found all plans
    if (results.size === planFilenames.length) break;
  }

  // Set null for any not found
  for (const filename of planFilenames) {
    if (!results.has(filename)) {
      results.set(filename, null);
      projectCache.set(filename, null);
    }
  }

  return results;
}

/**
 * Search a session file for multiple plan creations at once
 */
async function searchSessionForMultiplePlans(
  sessionPath: string,
  planPaths: Map<string, string>
): Promise<Map<string, string>> {
  return new Promise((resolve) => {
    const found = new Map<string, string>();
    const stream = createReadStream(sessionPath, { encoding: "utf-8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    let lastCwd: string | null = null;

    rl.on("line", (line) => {
      try {
        const parsed = JSON.parse(line) as SessionLine;

        if (parsed.cwd) {
          lastCwd = parsed.cwd;
        }

        const content = parsed.message?.content;
        if (Array.isArray(content) && lastCwd) {
          for (const item of content) {
            if (
              item.type === "tool_use" &&
              item.name === "Write" &&
              item.input?.file_path
            ) {
              const filename = planPaths.get(item.input.file_path);
              if (filename && !found.has(filename)) {
                found.set(filename, lastCwd);
              }
            }
          }
        }
      } catch {
        // Skip malformed lines
      }
    });

    rl.on("close", () => resolve(found));
    rl.on("error", () => resolve(found));
  });
}
