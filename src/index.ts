#!/usr/bin/env bun
/**
 * Claude Plans Organizer - CLI Entry Point
 *
 * A tool to browse Claude Code plans with human-readable names
 */

import { Command } from "commander";
import { browseCommand } from "./commands/browse.ts";
import { listCommand } from "./commands/list.ts";
import { viewCommand } from "./commands/view.ts";
import { copyCommand } from "./commands/copy.ts";
import { exportCommand } from "./commands/export.ts";
import { refreshCommand } from "./commands/refresh.ts";
import { statsCommand } from "./commands/stats.ts";
import { projectsCommand } from "./commands/projects.ts";

const program = new Command();

program
  .name("cpo")
  .description("Browse Claude Code plans with human-readable names")
  .version("1.0.0");

// Default command: interactive browser
program
  .command("browse", { isDefault: true })
  .description("Interactive plan browser (default)")
  .option("-c, --concurrency <n>", "Max parallel Claude CLI calls", "10")
  .action((options) => browseCommand({ concurrency: parseInt(options.concurrency, 10) }));

// List command
program
  .command("list")
  .alias("ls")
  .description("List all plans")
  .option("-s, --sort <by>", "Sort by: date, name, size", "date")
  .option("-r, --reverse", "Reverse sort order")
  .option("-n, --limit <n>", "Limit number of results")
  .option("-t, --tag <tag>", "Filter by tag")
  .option("-j, --json", "Output as JSON")
  .option("-c, --concurrency <n>", "Max parallel Claude CLI calls", "10")
  .action((options) => {
    listCommand({
      sortBy: options.sort as "date" | "name" | "size",
      reverse: options.reverse,
      limit: options.limit ? parseInt(options.limit, 10) : undefined,
      tag: options.tag,
      json: options.json,
      concurrency: parseInt(options.concurrency, 10),
    });
  });

// View command
program
  .command("view <plan>")
  .alias("show")
  .description("View a plan's content")
  .action(viewCommand);

// Copy command
program
  .command("copy <plan>")
  .alias("cp")
  .description("Copy plan content to clipboard")
  .action(copyCommand);

// Export command
program
  .command("export <plan> [destination]")
  .alias("save")
  .description("Export plan to a file")
  .action(exportCommand);

// Refresh command
program
  .command("refresh [plan]")
  .description("Force re-analyze plans")
  .option("-a, --all", "Refresh all plans")
  .action((plan, options) => refreshCommand(plan, options));

// Stats command
program
  .command("stats")
  .description("Show cache statistics")
  .action(statsCommand);

// Projects command - resolve project info (slow)
program
  .command("projects")
  .description("Resolve project directories for plans (slow - scans session files)")
  .action(projectsCommand);

program.parse();
