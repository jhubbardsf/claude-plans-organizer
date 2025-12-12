/**
 * Claude analyzer service
 * Uses Claude CLI to generate human-readable titles and descriptions for plans
 */

import { $ } from "bun";
import type {
  AnalysisResult,
  PlanFile,
  PlanMetadata,
  Result,
} from "../types/index.ts";
import { isAnalysisResult, ok, err, DEFAULT_CONFIG } from "../types/index.ts";
import { ScannerService } from "./scanner.ts";

const ANALYSIS_PROMPT = `You are analyzing a Claude Code plan file. Your task is to create a concise, human-readable title and description.

IMPORTANT: Respond ONLY with valid JSON, no markdown code blocks, no explanation.

Format:
{"title": "max 60 chars, descriptive title", "description": "1-2 sentence summary of what this plan accomplishes", "tags": ["1-3 relevant tags like: feature, bugfix, refactoring, api, ui, database, auth, performance"]}

Example response:
{"title": "JWT Authentication Implementation", "description": "Adds JWT-based auth to the Express API with refresh tokens and session management.", "tags": ["feature", "auth", "api"]}

Plan content to analyze:
`;

export class AnalyzerService {
  private scanner: ScannerService;
  private claudeCommand: string;
  private maxContentLength: number;
  private delayMs: number;

  constructor(
    scanner: ScannerService,
    claudeCommand: string = DEFAULT_CONFIG.claudeCommand,
    maxContentLength: number = DEFAULT_CONFIG.maxContentLength,
    delayMs: number = DEFAULT_CONFIG.analysisDelayMs
  ) {
    this.scanner = scanner;
    this.claudeCommand = claudeCommand;
    this.maxContentLength = maxContentLength;
    this.delayMs = delayMs;
  }

  /**
   * Analyze a plan file using Claude CLI
   */
  async analyze(planFile: PlanFile): Promise<Result<PlanMetadata, string>> {
    try {
      const content = await this.scanner.readContent(
        planFile.path,
        this.maxContentLength
      );

      const fullPrompt = ANALYSIS_PROMPT + content;

      // Write prompt to temp file to handle large content properly
      const tempFile = `/tmp/cpo-prompt-${Date.now()}.txt`;
      await Bun.write(tempFile, fullPrompt);

      // Use bash -ic to load aliases from .bashrc/.zshrc
      // Use cat to read the prompt file to avoid shell escaping issues
      const proc = Bun.spawn(["zsh", "-ic", `claude-h -p "$(cat '${tempFile}')"`], {
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          HOME: process.env.HOME,
        },
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      // Cleanup temp file
      try {
        await Bun.file(tempFile).exists() && (await $`rm ${tempFile}`.quiet());
      } catch {
        // Ignore cleanup errors
      }

      if (exitCode !== 0) {
        throw new Error(`Claude CLI failed (exit ${exitCode}): ${stderr || stdout}`);
      }

      const analysis = this.parseAnalysisResult(stdout, planFile.filename);

      const metadata: PlanMetadata = {
        filename: planFile.filename,
        checksum: planFile.checksum,
        title: analysis.title,
        description: analysis.description,
        tags: analysis.tags,
        project: null, // Will be set by the plans service
        analyzedAt: new Date(),
        modifiedAt: planFile.modifiedAt,
        sizeBytes: planFile.sizeBytes,
      };

      return ok(metadata);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(`Failed to analyze ${planFile.filename}: ${message}`);
    }
  }

  /**
   * Parse Claude's JSON response, with fallback to filename-based metadata
   */
  private parseAnalysisResult(
    response: string,
    filename: string
  ): AnalysisResult {
    try {
      // Try to extract JSON from the response (Claude sometimes adds extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed: unknown = JSON.parse(jsonMatch[0]);

      if (isAnalysisResult(parsed)) {
        return {
          title: parsed.title.slice(0, 60),
          description: parsed.description.slice(0, 200),
          tags: parsed.tags.slice(0, 3),
        };
      }

      throw new Error("Invalid analysis result structure");
    } catch {
      // Fallback: use filename as title
      return this.fallbackFromFilename(filename);
    }
  }

  /**
   * Generate fallback metadata from filename when Claude analysis fails
   */
  private fallbackFromFilename(filename: string): AnalysisResult {
    // Remove .md extension and convert hyphens to spaces
    const baseName = filename.replace(/\.md$/, "");
    const title = baseName
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return {
      title: title.slice(0, 60),
      description: "Plan file (analysis pending)",
      tags: ["uncategorized"],
    };
  }

  /**
   * Add a delay between analyses to avoid rate limiting
   */
  async delay(): Promise<void> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
  }

  /**
   * Check if Claude CLI is available
   */
  async isClaudeAvailable(): Promise<boolean> {
    try {
      await $`which claude`.quiet();
      return true;
    } catch {
      return false;
    }
  }
}
