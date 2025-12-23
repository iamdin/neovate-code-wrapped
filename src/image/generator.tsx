// Image generator using Satori and Resvg

import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { WrappedTemplate } from "./template";
import type { OpenCodeStats } from "../types";
import { loadFonts } from "./fonts";
import { layout } from "./design-tokens";

export interface GeneratedImage {
  /** Full resolution PNG buffer for saving/clipboard */
  fullSize: Buffer;
  /** Scaled PNG buffer for terminal display (80% of full size) */
  displaySize: Buffer;
}

export async function generateImage(stats: OpenCodeStats): Promise<GeneratedImage> {
  const svg = await satori(<WrappedTemplate stats={stats} />, {
    width: layout.canvas.width,
    height: layout.canvas.height,
    fonts: await loadFonts(),
  });

  const sizes = [layout.canvas.width, Math.round(layout.canvas.width * 0.75)];

  const [fullSize, displaySize] = sizes.map((size) => {
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: size,
      },
    });
    return Buffer.from(resvg.render().asPng());
  });

  return { fullSize, displaySize };
}
