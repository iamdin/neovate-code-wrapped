#!/usr/bin/env bun

import * as p from "@clack/prompts";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { xdgData } from "xdg-basedir";

import { checkOpenCodeDataExists } from "./collector";
import { calculateStats } from "./stats";
import { generateImage } from "./image/generator";
import { displayInTerminal, getTerminalName } from "./terminal/display";
import { copyImageToClipboard } from "./clipboard";
import { isWrappedAvailable } from "./utils/dates";
import { formatNumber } from "./utils/format";
import { detectInstalledAgents, displayAgentSuggestions } from "./agents";
import type { OpenCodeStats } from "./types";

const VERSION = "1.0.0";

function printHelp() {
  console.log(`
oc-wrapped v${VERSION}

Generate your OpenCode year in review stats card.

USAGE:
  oc-wrapped [OPTIONS]

OPTIONS:
  --year <YYYY>    Generate wrapped for a specific year (default: current year)
  --help, -h       Show this help message
  --version, -v    Show version number

EXAMPLES:
  oc-wrapped              # Generate current year wrapped
  oc-wrapped --year 2025  # Generate 2025 wrapped
`);
}

async function main() {
  // Parse command line arguments
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      year: { type: "string", short: "y" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  if (values.version) {
    console.log(`oc-wrapped v${VERSION}`);
    process.exit(0);
  }

  p.intro("opencode wrapped");

  const requestedYear = values.year ? parseInt(values.year, 10) : new Date().getFullYear();

  const availability = isWrappedAvailable(requestedYear);
  if (!availability.available) {
    if (Array.isArray(availability.message)) {
      availability.message.forEach((line) => p.log.warn(line));
    } else {
      p.log.warn(availability.message || "Wrapped not available yet.");
    }
    p.cancel();
    process.exit(0);
  }

  const dataExists = await checkOpenCodeDataExists();
  if (!dataExists) {
    p.cancel(`OpenCode data not found in ${xdgData}/opencode\n\nMake sure you have used OpenCode at least once.`);
    process.exit(0);
  }

  const spinner = p.spinner();
  spinner.start("Scanning your OpenCode history...");

  let stats;
  try {
    stats = await calculateStats(requestedYear);
  } catch (error) {
    spinner.stop("Failed to collect stats");
    p.cancel(`Error: ${error}`);
    process.exit(1);
  }

  if (stats.totalSessions === 0) {
    spinner.stop("No data found");
    p.cancel(`No OpenCode activity found for ${requestedYear}`);
    process.exit(0);
  }

  spinner.stop("Found your stats!");

  // Display summary
  const summaryLines = [
    `Sessions:      ${formatNumber(stats.totalSessions)}`,
    `Messages:      ${formatNumber(stats.totalMessages)}`,
    `Total Tokens:  ${formatNumber(stats.totalTokens)}`,
    `Projects:      ${formatNumber(stats.totalProjects)}`,
    `Streak:        ${stats.maxStreak} days`,
    stats.hasZenUsage && `Zen Cost:      ${stats.totalCost.toFixed(2)}$`,
    stats.mostActiveDay && `Most Active:   ${stats.mostActiveDay.formattedDate}`,
  ];

  p.note(summaryLines.join("\n"), `Your ${requestedYear} in OpenCode`);

  // Generate image
  spinner.start("Generating your wrapped image...");

  let image: { fullSize: Buffer; displaySize: Buffer };
  try {
    image = await generateImage(stats);
  } catch (error) {
    spinner.stop("Failed to generate image");
    p.cancel(`Error generating image: ${error}`);
    process.exit(1);
  }

  spinner.stop("Image generated!");

  const displayed = await displayInTerminal(image.displaySize);
  if (!displayed) {
    p.log.info(`Terminal (${getTerminalName()}) doesn't support inline images`);
  }

  const filename = `oc-wrapped-${requestedYear}.png`;
  const { success, error } = await copyImageToClipboard(image.fullSize, filename);

  if (success) {
    p.log.success("Automatically copied image to clipboard!");
  } else {
    p.log.warn(`Clipboard unavailable: ${error}`);
    p.log.info("You can save the image to disk instead.");
  }

  const defaultPath = join(process.env.HOME || "~", filename);

  const shouldSave = await p.confirm({
    message: `Save image to ~/${filename}?`,
    initialValue: true,
  });

  if (p.isCancel(shouldSave)) {
    p.outro("Cancelled");
    process.exit(0);
  }

  if (shouldSave) {
    try {
      await Bun.write(defaultPath, image.fullSize);
      p.log.success(`Saved to ${defaultPath}`);
    } catch (error) {
      p.log.error(`Failed to save: ${error}`);
    }
  }

  const shouldShare = await p.confirm({
    message: "Share on X (Twitter)? Don't forget to attach your image!",
    initialValue: true,
  });

  if (!p.isCancel(shouldShare) && shouldShare) {
    const tweetUrl = generateTweetUrl(stats);
    const opened = await openUrl(tweetUrl);
    if (opened) {
      p.log.success("Opened X in your browser.");
    } else {
      p.log.warn("Couldn't open browser. Copy this URL:");
      p.log.info(tweetUrl);
    }
  }

  const detectedAgents = await detectInstalledAgents();
  displayAgentSuggestions(detectedAgents);

  p.outro("Share your wrapped!");
  process.exit(0);
}

function generateTweetUrl(stats: OpenCodeStats): string {
  const text = [
    `my ${stats.year} opencode wrapped:`,
    ``,
    `${formatNumber(stats.totalSessions)} sessions`,
    `${formatNumber(stats.totalMessages)} messages`,
    `${formatNumber(stats.totalTokens)} tokens`,
    `${stats.maxStreak} day streak`,
    ``,
    `get yours: npx oc-wrapped`,
  ].join("\n");

  const url = new URL("https://x.com/intent/tweet");
  url.searchParams.set("text", text);
  return url.toString();
}

async function openUrl(url: string): Promise<boolean> {
  const platform = process.platform;
  let command: string;

  if (platform === "darwin") {
    command = "open";
  } else if (platform === "win32") {
    command = "start";
  } else {
    command = "xdg-open";
  }

  try {
    const proc = Bun.spawn([command, url], {
      stdout: "ignore",
      stderr: "ignore",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
