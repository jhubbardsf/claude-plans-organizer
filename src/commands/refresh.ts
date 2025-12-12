/**
 * Refresh command - force re-analysis of plans
 */

import { PlanService } from "../services/plans.ts";
import {
  displayError,
  displaySuccess,
  displayInfo,
} from "../utils/display.ts";

interface RefreshOptions {
  all?: boolean;
}

export async function refreshCommand(
  query?: string,
  options?: RefreshOptions
): Promise<void> {
  try {
    const service = new PlanService();

    if (options?.all || !query) {
      // Clear all cache and re-analyze
      await service.refresh();
      console.log(displayInfo("Cache cleared. Running full analysis..."));

      // Trigger re-analysis by getting all plans
      const plans = await service.getAllPlans();
      console.log(displaySuccess(`Refreshed ${plans.length} plans`));
    } else {
      // Refresh single plan
      const planResult = await service.getPlan(query);
      if (!planResult.success) {
        console.error(displayError(planResult.error));
        process.exit(1);
      }

      await service.refresh(planResult.data.filename);
      console.log(displayInfo(`Cleared cache for "${planResult.data.title}"`));

      // Re-analyze
      const plans = await service.getAllPlans();
      const refreshed = plans.find(
        (p) => p.filename === planResult.data.filename
      );

      if (refreshed) {
        console.log(
          displaySuccess(`Refreshed: "${refreshed.title}"`)
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(displayError(message));
    process.exit(1);
  }
}
