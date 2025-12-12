/**
 * List command - displays all plans in a table
 */

import type { ListOptions } from "../types/index.ts";
import { PlanService } from "../services/plans.ts";
import {
  createPlanTable,
  createCompactList,
  displayError,
  displayInfo,
} from "../utils/display.ts";

export async function listCommand(options: Partial<ListOptions>): Promise<void> {
  try {
    const service = new PlanService();
    const plans = await service.getAllPlans(options);

    if (plans.length === 0) {
      console.log(displayInfo(`No plans found in ${service.getPlansDir()}`));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(plans, null, 2));
      return;
    }

    // Use compact list for better readability
    console.log("\n" + createCompactList(plans));

    // Show summary
    const plansDir = service.getPlansDir();
    console.log(
      displayInfo(`${plans.length} plans in ${plansDir}`)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(displayError(message));
    process.exit(1);
  }
}
