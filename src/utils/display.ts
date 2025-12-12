/**
 * Display utilities for terminal output
 */

import chalk from "chalk";
import Table from "cli-table3";
import type { PlanMetadata } from "../types/index.ts";

/**
 * Format a date for display
 */
export function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return chalk.green("today");
  } else if (diffDays === 1) {
    return chalk.green("yesterday");
  } else if (diffDays < 7) {
    return chalk.yellow(`${diffDays}d ago`);
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return chalk.dim(`${weeks}w ago`);
  } else {
    return chalk.dim(
      date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    );
  }
}

/**
 * Format file size for display
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}K`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  }
}

/**
 * Format tags for display
 */
export function formatTags(tags: string[]): string {
  return tags.map((tag) => chalk.cyan(`#${tag}`)).join(" ");
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}

/**
 * Format project path for display
 * Extracts meaningful short name from full path
 */
export function formatProject(projectPath: string | null): string {
  if (!projectPath) return chalk.dim("unknown");

  // Get meaningful parts of the path (skip common prefixes)
  const parts = projectPath.split("/").filter(Boolean);

  // Find where the meaningful project name starts
  // Skip: Users, username, common dirs like Engineering, Code, Projects
  const skipPrefixes = ["Users", "home", "Engineering", "Code", "Projects", "src", "repos"];
  let startIdx = 0;
  for (let i = 0; i < parts.length; i++) {
    if (skipPrefixes.includes(parts[i] ?? "") || (parts[i]?.length ?? 0) <= 4) {
      startIdx = i + 1;
    } else {
      break;
    }
  }

  // Take 1-2 meaningful directory names
  const meaningfulParts = parts.slice(startIdx, startIdx + 2);

  if (meaningfulParts.length === 0) {
    // Fallback to last 2 parts
    return chalk.magenta(parts.slice(-2).join("/"));
  }

  return chalk.magenta(meaningfulParts.join("/"));
}

/**
 * Create a table display of plans
 */
export function createPlanTable(plans: PlanMetadata[]): string {
  const table = new Table({
    head: [
      chalk.bold("#"),
      chalk.bold("Title"),
      chalk.bold("Description"),
      chalk.bold("Modified"),
      chalk.bold("Size"),
    ],
    colWidths: [4, 35, 45, 12, 8],
    wordWrap: true,
    style: {
      head: [],
      border: ["dim"],
    },
  });

  plans.forEach((plan, index) => {
    table.push([
      chalk.dim(String(index + 1)),
      chalk.white(truncate(plan.title, 33)),
      chalk.dim(truncate(plan.description, 43)),
      formatDate(plan.modifiedAt),
      chalk.dim(formatSize(plan.sizeBytes)),
    ]);
  });

  return table.toString();
}

/**
 * Create a compact list display
 */
export function createCompactList(plans: PlanMetadata[]): string {
  const lines: string[] = [];

  plans.forEach((plan, index) => {
    const num = chalk.dim(`${String(index + 1).padStart(2)}.`);
    const title = chalk.white(truncate(plan.title, 45));
    const date = formatDate(plan.modifiedAt);
    const tags = plan.tags.length > 0 ? " " + formatTags(plan.tags) : "";
    const project = plan.project ? ` ${chalk.dim("in")} ${formatProject(plan.project)}` : "";

    lines.push(`${num} ${title} ${chalk.dim("·")} ${date}${tags}`);
    if (plan.description) {
      lines.push(`    ${chalk.dim(truncate(plan.description, 65))}${project}`);
    }
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Display a single plan's details
 */
export function displayPlanDetails(plan: PlanMetadata): string {
  const lines = [
    "",
    chalk.bold.white(plan.title),
    chalk.dim("─".repeat(60)),
    "",
    chalk.dim("Description: ") + plan.description,
    chalk.dim("Tags:        ") + formatTags(plan.tags),
    chalk.dim("Project:     ") + (plan.project || chalk.dim("unknown")),
    chalk.dim("Modified:    ") + plan.modifiedAt.toLocaleString(),
    chalk.dim("Size:        ") + formatSize(plan.sizeBytes),
    chalk.dim("File:        ") + plan.filename,
    "",
  ];

  return lines.join("\n");
}

/**
 * Display a header banner
 */
export function displayHeader(): string {
  return [
    "",
    chalk.bold.cyan("  Claude Plans Organizer"),
    chalk.dim("  Browse your Claude Code plans with human-readable names"),
    "",
  ].join("\n");
}

/**
 * Display an error message
 */
export function displayError(message: string): string {
  return chalk.red(`✗ ${message}`);
}

/**
 * Display a success message
 */
export function displaySuccess(message: string): string {
  return chalk.green(`✓ ${message}`);
}

/**
 * Display a warning message
 */
export function displayWarning(message: string): string {
  return chalk.yellow(`⚠ ${message}`);
}

/**
 * Display an info message
 */
export function displayInfo(message: string): string {
  return chalk.blue(`ℹ ${message}`);
}
