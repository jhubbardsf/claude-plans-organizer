/**
 * Projects command - resolve and display project info for plans
 */

import { PlanService } from "../services/plans.ts";
import {
  displayError,
  displaySuccess,
  displayInfo,
} from "../utils/display.ts";

export async function projectsCommand(): Promise<void> {
  try {
    const service = new PlanService();

    // First ensure plans are cached
    console.log(displayInfo("Loading plans..."));
    await service.getAllPlans();

    // Then resolve projects
    const resolved = await service.resolveAllProjects();

    if (resolved === 0) {
      console.log(displayInfo("All plans already have project info"));
    } else {
      console.log(displaySuccess(`Resolved projects for ${resolved} plans`));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(displayError(message));
    process.exit(1);
  }
}
