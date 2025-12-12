/**
 * Stats command - display cache and plan statistics
 */

import chalk from "chalk";
import { PlanService } from "../services/plans.ts";
import { displayError } from "../utils/display.ts";

export async function statsCommand(): Promise<void> {
  try {
    const service = new PlanService();
    const stats = await service.getStats();

    console.log("");
    console.log(chalk.bold("  Claude Plans Organizer Statistics"));
    console.log(chalk.dim("  ─".repeat(30)));
    console.log("");
    console.log(chalk.dim("  Plans Directory:  ") + stats.plansDirectory);
    console.log(chalk.dim("  Cache File:       ") + stats.cacheFile);
    console.log("");
    console.log(
      chalk.dim("  Total Plans:      ") + chalk.white(stats.totalPlans)
    );
    console.log(
      chalk.dim("  Cached Plans:     ") + chalk.white(stats.cachedPlans)
    );
    console.log(
      chalk.dim("  Pending Analysis: ") +
        chalk.yellow(stats.totalPlans - stats.cachedPlans)
    );
    console.log("");

    if (stats.lastUpdated) {
      const lastUpdated = new Date(stats.lastUpdated);
      console.log(
        chalk.dim("  Last Updated:     ") +
          lastUpdated.toLocaleString()
      );
    }
    console.log("");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(displayError(message));
    process.exit(1);
  }
}
