/**
 * Browse command - interactive plan browser
 */

import { select, input } from "@inquirer/prompts";
import chalk from "chalk";
import type { PlanMetadata, PlanAction } from "../types/index.ts";
import { PlanService } from "../services/plans.ts";
import { copyToClipboard } from "../utils/clipboard.ts";
import {
  displayHeader,
  displayError,
  displaySuccess,
  displayPlanDetails,
  formatDate,
  formatSize,
  truncate,
} from "../utils/display.ts";

export async function browseCommand(): Promise<void> {
  console.log(displayHeader());

  try {
    const service = new PlanService();
    const plans = await service.getAllPlans();

    if (plans.length === 0) {
      console.log(displayError(`No plans found in ${service.getPlansDir()}`));
      return;
    }

    // Main loop
    let running = true;
    while (running) {
      const selectedPlan = await selectPlan(plans);

      if (!selectedPlan) {
        running = false;
        continue;
      }

      const action = await selectAction(selectedPlan);

      switch (action) {
        case "view":
          await viewPlan(service, selectedPlan);
          break;
        case "copy":
          await copyPlan(service, selectedPlan);
          break;
        case "export":
          await exportPlan(service, selectedPlan);
          break;
        case "edit":
          await editPlan(service, selectedPlan);
          break;
        case "back":
          // Continue loop
          break;
      }
    }

    console.log("\n" + chalk.dim("Goodbye!") + "\n");
  } catch (error) {
    // Handle Ctrl+C gracefully
    if (error instanceof Error && error.message.includes("User force closed")) {
      console.log("\n" + chalk.dim("Goodbye!") + "\n");
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(displayError(message));
    process.exit(1);
  }
}

async function selectPlan(plans: PlanMetadata[]): Promise<PlanMetadata | null> {
  const choices = plans.map((plan, index) => ({
    name: formatPlanChoice(plan, index),
    value: plan,
    description: plan.description,
  }));

  // Add exit option
  choices.push({
    name: chalk.dim("Exit"),
    value: null as unknown as PlanMetadata,
    description: "Exit the browser",
  });

  const selected = await select({
    message: "Select a plan:",
    choices,
    pageSize: 15,
  });

  return selected;
}

function formatPlanChoice(plan: PlanMetadata, index: number): string {
  const num = chalk.dim(`${String(index + 1).padStart(2)}.`);
  const title = truncate(plan.title, 40);
  const date = formatDate(plan.modifiedAt);
  const size = chalk.dim(formatSize(plan.sizeBytes));

  return `${num} ${title} ${chalk.dim("·")} ${date} ${chalk.dim("·")} ${size}`;
}

async function selectAction(plan: PlanMetadata): Promise<PlanAction> {
  console.log(displayPlanDetails(plan));

  const action = await select<PlanAction>({
    message: "What would you like to do?",
    choices: [
      {
        name: "View full content",
        value: "view",
        description: "Display the complete plan in terminal",
      },
      {
        name: "Copy to clipboard",
        value: "copy",
        description: "Copy plan content to system clipboard",
      },
      {
        name: "Export to file",
        value: "export",
        description: "Save plan to a file location of your choice",
      },
      {
        name: "Open in editor",
        value: "edit",
        description: "Open the plan file in your default editor",
      },
      {
        name: chalk.dim("← Back to list"),
        value: "back",
      },
    ],
  });

  return action;
}

async function viewPlan(
  service: PlanService,
  plan: PlanMetadata
): Promise<void> {
  const contentResult = await service.getContent(plan.filename);
  if (!contentResult.success) {
    console.error(displayError(contentResult.error));
    return;
  }

  console.log("\n" + chalk.dim("─".repeat(60)) + "\n");
  console.log(contentResult.data);
  console.log("\n" + chalk.dim("─".repeat(60)) + "\n");

  // Wait for user to press enter
  await input({
    message: chalk.dim("Press Enter to continue..."),
  });
}

async function copyPlan(
  service: PlanService,
  plan: PlanMetadata
): Promise<void> {
  const contentResult = await service.getContent(plan.filename);
  if (!contentResult.success) {
    console.error(displayError(contentResult.error));
    return;
  }

  await copyToClipboard(contentResult.data);
  console.log(displaySuccess(`Copied to clipboard!`));
}

async function exportPlan(
  service: PlanService,
  plan: PlanMetadata
): Promise<void> {
  const defaultPath = `./${plan.filename}`;

  const destination = await input({
    message: "Export to:",
    default: defaultPath,
  });

  const contentResult = await service.getContent(plan.filename);
  if (!contentResult.success) {
    console.error(displayError(contentResult.error));
    return;
  }

  await Bun.write(destination, contentResult.data);
  console.log(displaySuccess(`Exported to ${destination}`));
}

async function editPlan(
  service: PlanService,
  plan: PlanMetadata
): Promise<void> {
  const planPath = service.getPlanPath(plan.filename);
  const editor = process.env.EDITOR || "vim";

  const proc = Bun.spawn([editor, planPath], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  await proc.exited;
}
