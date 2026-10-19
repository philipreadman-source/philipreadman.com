// Split a 2× Figma pair export (two 820.5-wide halves, 32px apart, in a 1673 frame)
// into its left (a) and right (b) halves.
//
//   node tools/split-pair.mjs <dir> <name> [<name>…]   e.g. raw/dobbin 07 10 → 07a.png, 07b.png, …

import sharp from "sharp";

const [dir, ...names] = process.argv.slice(2);
if (!dir || !names.length) {
  console.error("usage: node tools/split-pair.mjs <dir> <name> [<name>…]");
  process.exit(1);
}
for (const n of names) {
  const src = `${dir}/${n}.png`;
  const { width, height } = await sharp(src).metadata();
  const half = Math.round(width * 820.5 / 1673);
  await sharp(src).extract({ left: 0, top: 0, width: half, height }).toFile(`${dir}/${n}a.png`);
  await sharp(src).extract({ left: width - half, top: 0, width: half, height }).toFile(`${dir}/${n}b.png`);
  console.log(`${n} → ${n}a.png, ${n}b.png (${half} × ${height})`);
}
