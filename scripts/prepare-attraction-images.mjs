import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error('Usage: node scripts/prepare-attraction-images.mjs <download-directory>');
const catalog = JSON.parse(await fs.readFile('attraction-photo-sources.json', 'utf8'));
const output = 'public/images/attractions';
await fs.mkdir(output, { recursive: true });
for (const photo of catalog) {
  const input = path.join(sourceDirectory, photo.filename);
  const basename = path.parse(photo.filename).name;
  for (const width of [640, 1280]) {
    let image = sharp(input).rotate();
    // Focus the dolphin photograph on the animals and rings rather than the roof.
    if (photo.title === 'Dolphin Watching') {
      image = image.extract({ left: 430, top: 360, width: 700, height: 520 });
    }
    await image.resize({ width }).webp({ quality: 80, effort: 5 })
      .toFile(path.join(output, `${basename}-${width}.webp`));
  }
}
console.log(`Prepared ${catalog.length} photos in two responsive sizes.`);
