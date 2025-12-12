/**
 * Export command - export plan to a file
 */

import { PlanService } from "../services/plans.ts";
import {
  displayError,
  displaySuccess,
  formatSize,
} from "../utils/display.ts";

export async function exportCommand(
  query: string,
  destination?: string
): Promise<void> {
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

    // Determine output path
    const outputPath = destination || `./${plan.filename}`;

    // Write file
    await Bun.write(outputPath, contentResult.data);

    console.log(
      displaySuccess(
        `Exported "${plan.title}" to ${outputPath} (${formatSize(plan.sizeBytes)})`
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(displayError(message));
    process.exit(1);
  }
}
