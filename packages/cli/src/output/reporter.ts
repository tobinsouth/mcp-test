import type { TestReport, PhaseResult } from "@mcp-qa/types";
import { bold, dim, green, red, yellow, gray, statusText, cyan } from "./colors.js";

/**
 * Format a complete test report for console output
 */
export function formatReport(report: TestReport): string {
  const lines: string[] = [];

  // Header
  lines.push("");
  lines.push(bold("═══════════════════════════════════════════════════════════"));
  lines.push(bold("                    MCP QA Test Report"));
  lines.push(bold("═══════════════════════════════════════════════════════════"));
  lines.push("");

  // Server info
  lines.push(`Server: ${cyan(report.serverUrl)}`);
  if (report.serverName) {
    lines.push(`Name:   ${report.serverName}`);
  }
  lines.push(`Duration: ${formatDuration(report.totalDurationMs)}`);
  lines.push("");

  // Overall status
  const statusLine = `Overall Status: ${statusText(report.overallStatus)}`;
  lines.push(bold(statusLine));
  lines.push("");

  // Summary
  lines.push(bold("Summary:"));
  lines.push(`  Total Checks:  ${report.summary.totalChecks}`);
  lines.push(`  ${green("Passed")}:       ${report.summary.passed}`);
  lines.push(`  ${red("Failed")}:       ${report.summary.failed}`);
  lines.push(`  ${yellow("Warnings")}:     ${report.summary.warnings}`);
  lines.push(`  ${gray("Skipped")}:      ${report.summary.skipped}`);
  lines.push("");

  // Phase breakdown
  if (report.phases.length > 0) {
    lines.push(bold("Phase Results:"));
    for (const phase of report.phases) {
      lines.push(formatPhaseResult(phase));
    }
    lines.push("");
  }

  // Failures (if any)
  const failures = report.phases.flatMap((p) => p.checks.filter((c) => c.status === "FAILURE"));
  if (failures.length > 0) {
    lines.push(bold(red("Failures:")));
    for (const failure of failures) {
      lines.push(`  ${red("✗")} ${failure.name}`);
      lines.push(`    ${dim(failure.description)}`);
      if (failure.errorMessage) {
        lines.push(`    ${red(failure.errorMessage)}`);
      }
    }
    lines.push("");
  }

  // Warnings (if any)
  const warnings = report.phases.flatMap((p) => p.checks.filter((c) => c.status === "WARNING"));
  if (warnings.length > 0) {
    lines.push(bold(yellow("Warnings:")));
    for (const warning of warnings) {
      lines.push(`  ${yellow("⚠")} ${warning.name}`);
      lines.push(`    ${dim(warning.description)}`);
    }
    lines.push("");
  }

  lines.push(dim("═══════════════════════════════════════════════════════════"));

  return lines.join("\n");
}

/**
 * Format a single phase result
 */
function formatPhaseResult(phase: PhaseResult): string {
  const status =
    phase.summary.failure > 0
      ? red("FAIL")
      : phase.summary.warning > 0
        ? yellow("WARN")
        : green("PASS");

  const counts = [
    phase.summary.success > 0 ? green(`${phase.summary.success} passed`) : null,
    phase.summary.failure > 0 ? red(`${phase.summary.failure} failed`) : null,
    phase.summary.warning > 0 ? yellow(`${phase.summary.warning} warnings`) : null,
  ]
    .filter(Boolean)
    .join(", ");

  return `  ${status} ${bold(phase.name)} (${formatDuration(phase.durationMs)}): ${counts || "no checks"}`;
}

/**
 * Format duration in human readable form
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format report as JSON string
 */
export function formatReportJson(report: TestReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Print a simple summary line
 */
export function printSummaryLine(report: TestReport): void {
  console.log(`\nTest completed: ${statusText(report.overallStatus)}`);
  console.log(`  Total: ${report.summary.totalChecks}`);
  console.log(`  Passed: ${report.summary.passed}`);
  console.log(`  Failed: ${report.summary.failed}`);
  console.log(`  Warnings: ${report.summary.warnings}`);
}
