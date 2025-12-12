/**
 * View command - display a single plan's content
 */

import chalk from "chalk";
import { PlanService } from "../services/plans.ts";
import {
  displayPlanDetails,
  displayError,
} from "../utils/display.ts";

export async function viewCommand(query: string): Promise<void> {
  try {
    const service = new PlanService();

    // Find the plan
    const planResult = await service.getPlan(query);
    if (!planResult.success) {
      console.error(displayError(planResult.error));
      process.exit(1);
    }

    const plan = planResult.data;

    // Display metadata
    console.log(displayPlanDetails(plan));

    // Display content
    const contentResult = await service.getContent(plan.filename);
    if (!contentResult.success) {
      console.error(displayError(contentResult.error));
      process.exit(1);
    }

    console.log(chalk.dim("─".repeat(60)));
    console.log("");
    console.log(contentResult.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(displayError(message));
    process.exit(1);
  }
}
