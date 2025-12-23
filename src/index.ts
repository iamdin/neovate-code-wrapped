#!/usr/bin/env bun

// OpenCode Wrapped - CLI Entry Point

import * as p from "@clack/prompts";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { setImageBase64 } from "@crosscopy/clipboard";

import { checkOpenCodeDataExists } from "./collector";
import { calculateStats } from "./stats";
import { generateImage } from "./image/generator";
import { displayInTerminal, getTerminalName } from "./terminal/display";
import { isWrappedAvailable } from "./utils/dates";
import { formatNumber } from "./utils/format";

const VERSION = "1.0.0";

function printHelp() {
  console.log(`
opencode-wrapped v${VERSION}

Generate your OpenCode year in review stats card.

USAGE:
  opencode-wrapped [OPTIONS]

OPTIONS:
  --year <YYYY>    Generate wrapped for a specific year (default: current year)
  --help, -h       Show this help message
  --version, -v    Show version number

EXAMPLES:
  opencode-wrapped              # Generate current year wrapped
  opencode-wrapped --year 2025  # Generate 2025 wrapped
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
    console.log(`opencode-wrapped v${VERSION}`);
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
    p.cancel("OpenCode data not found at ~/.local/share/opencode\n\nMake sure you have used OpenCode at least once.");
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

  const defaultPath = join(process.env.HOME || "~", `opencode-wrapped-${requestedYear}.png`);

  const shouldSave = await p.confirm({
    message: `Save image to ~/opencode-wrapped-${requestedYear}.png?`,
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

  const shouldCopy = await p.confirm({
    message: "Copy to clipboard?",
    initialValue: true,
  });

  if (!p.isCancel(shouldCopy) && shouldCopy) {
    try {
      await copyImageToClipboard(image.fullSize);
      p.log.success("Copied to clipboard!");
    } catch (error) {
      p.log.error(`Failed to copy: ${error}`);
    }
  }

  p.outro("Share your wrapped! 🎉");
  process.exit(0);
}

async function copyImageToClipboard(pngBuffer: Buffer): Promise<void> {
  await setImageBase64(pngBuffer.toString("base64"));
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
