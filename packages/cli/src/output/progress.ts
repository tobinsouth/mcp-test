import type { TestCheck } from "@mcp-qa/types";
import { statusIcon, bold, dim, cyan } from "./colors.js";

/**
 * Format a check for console output
 */
export function formatCheck(phase: string, check: TestCheck): string {
  const icon = statusIcon(check.status);
  const phaseLabel = dim(`[${phase}]`);
  const name = bold(check.name);
  const description = check.description;

  return `${phaseLabel} ${icon} ${name}: ${description}`;
}

/**
 * Format phase header
 */
export function formatPhaseStart(phaseName: string): string {
  return `\n${cyan(bold(`=== ${phaseName} ===`))}`;
}

/**
 * Format phase completion
 */
export function formatPhaseComplete(phaseName: string, durationMs: number): string {
  const duration = durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`;
  return dim(`Phase ${phaseName} completed in ${duration}`);
}

/**
 * Create a simple progress indicator
 */
export class ProgressIndicator {
  private currentPhase = "";
  private checkCount = 0;

  /**
   * Called when a new phase starts
   */
  onPhaseStart(phase: string): void {
    this.currentPhase = phase;
    this.checkCount = 0;
    console.log(formatPhaseStart(phase));
  }

  /**
   * Called when a check is completed
   */
  onCheck(phase: string, check: TestCheck): void {
    if (phase !== this.currentPhase) {
      this.onPhaseStart(phase);
    }
    this.checkCount++;
    console.log(formatCheck(phase, check));
  }

  /**
   * Called when a phase completes
   */
  onPhaseComplete(phase: string, durationMs: number): void {
    console.log(formatPhaseComplete(phase, durationMs));
  }
}

/**
 * Create a verbose progress callback
 */
export function createVerboseProgressCallback(): (phase: string, check: TestCheck) => void {
  return (phase, check) => {
    console.log(formatCheck(phase, check));
  };
}

/**
 * Create a quiet progress callback (only shows failures and warnings)
 */
export function createQuietProgressCallback(): (phase: string, check: TestCheck) => void {
  return (phase, check) => {
    if (check.status === "FAILURE" || check.status === "WARNING") {
      console.log(formatCheck(phase, check));
    }
  };
}
