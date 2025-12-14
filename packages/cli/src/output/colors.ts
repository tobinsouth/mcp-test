/**
 * Terminal color codes
 */
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground colors
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

let colorsEnabled = true;

/**
 * Enable or disable colors
 */
export function setColorsEnabled(enabled: boolean): void {
  colorsEnabled = enabled;
}

/**
 * Check if colors are enabled
 */
export function areColorsEnabled(): boolean {
  return colorsEnabled;
}

/**
 * Apply color to text
 */
function colorize(text: string, color: keyof typeof colors): string {
  if (!colorsEnabled) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

export function bold(text: string): string {
  return colorize(text, "bold");
}

export function dim(text: string): string {
  return colorize(text, "dim");
}

export function red(text: string): string {
  return colorize(text, "red");
}

export function green(text: string): string {
  return colorize(text, "green");
}

export function yellow(text: string): string {
  return colorize(text, "yellow");
}

export function blue(text: string): string {
  return colorize(text, "blue");
}

export function magenta(text: string): string {
  return colorize(text, "magenta");
}

export function cyan(text: string): string {
  return colorize(text, "cyan");
}

export function gray(text: string): string {
  return colorize(text, "gray");
}

/**
 * Get status icon with color
 */
export function statusIcon(status: string): string {
  switch (status) {
    case "SUCCESS":
      return green("✓");
    case "FAILURE":
      return red("✗");
    case "WARNING":
      return yellow("⚠");
    case "SKIPPED":
      return gray("○");
    case "INFO":
      return blue("•");
    default:
      return dim("?");
  }
}

/**
 * Get status text with color
 */
export function statusText(status: string): string {
  switch (status) {
    case "SUCCESS":
    case "PASS":
      return green(status);
    case "FAILURE":
    case "FAIL":
      return red(status);
    case "WARNING":
    case "WARN":
      return yellow(status);
    case "SKIPPED":
      return gray(status);
    case "INFO":
      return blue(status);
    default:
      return dim(status);
  }
}
