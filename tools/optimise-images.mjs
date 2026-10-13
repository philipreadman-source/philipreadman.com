// Turn a 2× Figma export into web-ready 1× and 2× images.
//
//   node tools/optimise-images.mjs <source> <output-base> [--photo] [--width=1673]
//
//   <source>       2× export from Figma (PNG preferred, so nothing is compressed twice)
//   <output-base>  path without extension, e.g. site/img/sr/hero
//                  → hero-1x.png + hero-2x.png   (UI frames: palette PNG, sharp text and edges)
//                  → hero-1x.jpg + hero-2x.jpg   (with --photo: mostly-photographic frames)
//   --width        display width at 1× in CSS px (default: half the source width)
//   --quality      JPG quality for --photo (default 84); lower for busy, darkened backgrounds
//
// Use in HTML with width descriptors, so each screen downloads only what it needs:
//   <img src="hero-1x.png" srcset="hero-1x.png 1673w, hero-2x.png 3346w" sizes="…">

import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";

const [src, base, ...flags] = process.argv.slice(2);
if (!src || !base) {
  console.error("usage: node tools/optimise-images.mjs <source> <output-base> [--photo] [--width=N]");
  process.exit(1);
}
const photo = flags.includes("--photo");
const widthFlag = flags.find((f) => f.startsWith("--width="));
const qualityFlag = flags.find((f) => f.startsWith("--quality="));
const jpgQuality = qualityFlag ? Number(qualityFlag.split("=")[1]) : 84;

const meta = await sharp(src).metadata();
const w1 = widthFlag ? Number(widthFlag.split("=")[1]) : Math.round(meta.width / 2);
const sizes = [[w1, "1x"], [Math.min(w1 * 2, meta.width), "2x"]];
await mkdir(dirname(base), { recursive: true });

const kb = async (p) => `${((await stat(p)).size / 1024).toFixed(0)} KB`;
for (const [width, tag] of sizes) {
  const img = sharp(src).resize({ width, kernel: "lanczos3" });
  const out = `${base}-${tag}.${photo ? "jpg" : "png"}`;
  if (photo) {
    // mozjpeg, high quality, 4:4:4 chroma so UI edges in photo frames stay clean
    await img.jpeg({ quality: jpgQuality, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(out);
  } else {
    // libimagequant (pngquant's engine): up to 256 colours, visually lossless for UI
    await img.png({ palette: true, quality: 92, effort: 10, compressionLevel: 9, dither: 0.8 }).toFile(out);
  }
  console.log(`${out}  ${width}w  ${await kb(out)}`);
}
