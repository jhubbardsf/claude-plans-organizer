/**
 * Copy command - copy plan content to clipboard
 */

import { PlanService } from "../services/plans.ts";
import { copyToClipboard } from "../utils/clipboard.ts";
import {
  displayError,
  displaySuccess,
  formatSize,
} from "../utils/display.ts";

export async function copyCommand(query: string): Promise<void> {
  try {
    const service = new PlanService();

    // Find the plan
    const planResult = await service.getPlan(query);
    if (!planResult.success) {
      console.error(displayError(planResult.error));
      process.exit(1);
    }

    const plan = planResult.data;

    // Get content
    const contentResult = await service.getContent(plan.filename);
    if (!contentResult.success) {
      console.error(displayError(contentResult.error));
      process.exit(1);
    }

    // Copy to clipboard
    await copyToClipboard(contentResult.data);

    console.log(
      displaySuccess(
        `Copied "${plan.title}" to clipboard (${formatSize(plan.sizeBytes)})`
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(displayError(message));
    process.exit(1);
  }
}
