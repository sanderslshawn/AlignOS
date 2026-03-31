#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function generate() {
  const repoRoot = path.resolve(__dirname, '..');
  const svgPath = path.join(repoRoot, 'apps', 'mobile', 'assets', 'icons', 'AlignAIcon.svg');
  const pngSourcePath = path.join(repoRoot, 'apps', 'mobile', 'assets', 'icons', 'AlignAIcon-source.png');
  const altPng = path.join(repoRoot, 'apps', 'mobile', 'assets', 'icons', 'AlignOS logo and icon.png');
  const outDir = path.join(repoRoot, 'apps', 'mobile', 'assets', 'icons', 'ios');

  const sizes = [1024, 180, 167, 152, 120, 87, 80, 76, 60, 58, 40, 29, 20];

  // Prefer a provided raster source if present (useful when you drop the attached image)
  if (!fs.existsSync(svgPath) && !fs.existsSync(pngSourcePath) && !fs.existsSync(altPng)) {
    console.error('Source SVG or PNG not found. Place AlignAIcon.svg or AlignAIcon-source.png (or "AlignOS logo and icon.png") in apps/mobile/assets/icons/');
    process.exit(2);
  }

  // choose preferred raster source if present
  let chosenRaster = null;
  if (fs.existsSync(altPng)) chosenRaster = altPng;
  else if (fs.existsSync(pngSourcePath)) chosenRaster = pngSourcePath;
  const sourceIsPng = !!chosenRaster;

  await ensureDir(outDir);
  // First create a canonical 1024 PNG (flattened) from the preferred source
  const canonical1024 = path.join(outDir, 'icon-1024.png');
  try {
    const inputPath = sourceIsPng ? chosenRaster : svgPath;
    const base = sharp(inputPath).resize(1024, 1024, { fit: 'contain' });
    await base.flatten({ background: '#0B0F1A' }).png().toFile(canonical1024);
    console.log('Generated', canonical1024);
  } catch (err) {
    console.error('Failed to generate canonical 1024 icon', err);
    process.exit(1);
  }

  // Derive all other sizes from the canonical 1024 so they look identical
  for (const size of sizes) {
    const outFile = path.join(outDir, `icon-${size}.png`);
    try {
      if (size === 1024) continue; // already created
      await sharp(canonical1024).resize(size, size, { fit: 'contain' }).png().toFile(outFile);
      console.log('Generated', outFile);
    } catch (err) {
      console.error('Failed to generate', outFile, err);
      process.exitCode = 1;
    }
  }
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
