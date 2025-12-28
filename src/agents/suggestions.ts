import * as p from "@clack/prompts";
import type { DetectedAgent } from "./detector";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, "");
  const fullHex =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(fullHex, 16);
  if (isNaN(num)) return { r: 255, g: 255, b: 255 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function colorize(text: string, hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
}

function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`;
}

function reset(text: string): string {
  return `\x1b[0m${text}\x1b[0m`;
}

function hyperlink(text: string, url: string): string {
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

function underline(text: string): string {
  return `\x1b[4m${text}\x1b[0m`;
}

export function displayStyledSuggestions(agents: DetectedAgent[]): void {
  if (agents.length === 0) return;

  const maxNameLength = Math.max(...agents.map((a) => a.name.length));
  const lines = agents.map((agent) => {
    const coloredName = colorize(agent.name, agent.brandColor);
    const linkedName = underline(hyperlink(coloredName, agent.repoUrl));
    const padding = " ".repeat(maxNameLength - agent.name.length);

    return reset(`  ${linkedName}${padding}  ${dim("→")}  ${dim(agent.wrappedCommand)}`);
  });

  const content = [...lines, "", "Generate wrapped stats for those too!"].join("\n");
  p.note(content, "Other AI agents detected on your system");
}

export function displayAgentSuggestions(agents: DetectedAgent[]): void {
  if (agents.length === 0) return;
  displayStyledSuggestions(agents);
}
