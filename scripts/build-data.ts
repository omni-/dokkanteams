// Builds public/data/units.json and public/images/thumbs from a DokkanWebScraper character file.
//   npm run data -- [path/to/yyyyMMddDokkanCharacterData.json]
// With no path it uses the newest dated file in ../DokkanWebScraper/data.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDataset } from '../src/core/dataset.ts';
import type { ScrapedCharacter } from '../src/core/dataset.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultDataDirectory = resolve(root, '../DokkanWebScraper/data');

const inputPath = process.argv[2] ? resolve(process.argv[2]) : newestScrape(defaultDataDirectory);
const thumbSource = join(dirname(inputPath), 'images', 'thumbs');
const dataTarget = join(root, 'public', 'data', 'units.json');
const thumbTarget = join(root, 'public', 'images', 'thumbs');

const characters = JSON.parse(readFileSync(inputPath, 'utf8')) as ScrapedCharacter[];
if (!Array.isArray(characters) || characters.length === 0) {
  throw new Error(`${inputPath} has no characters.`);
}

const { dataset, skipped } = buildDataset(characters, basename(inputPath));
for (const reason of skipped) console.warn(`Skipped ${reason}`);

mkdirSync(dirname(dataTarget), { recursive: true });
writeFileSync(dataTarget, JSON.stringify(dataset));

mkdirSync(thumbTarget, { recursive: true });
const missingThumbs: number[] = [];
let copied = 0;
for (const unit of dataset.units) {
  const source = join(thumbSource, `${unit.id}.png`);
  const target = join(thumbTarget, `${unit.id}.png`);
  if (!existsSync(source)) {
    missingThumbs.push(unit.id);
    continue;
  }
  if (!existsSync(target)) {
    copyFileSync(source, target);
    copied++;
  }
}
if (missingThumbs.length > 0) console.warn(`No thumb for ${missingThumbs.length} units: ${missingThumbs.join(', ')}`);

const forms = dataset.units.filter(unit => unit.formOf != null).length;
const leaders = dataset.units.filter(unit => unit.leader).length;
console.log(
  `Wrote ${dataset.units.length} units (${forms} transformed forms, ${leaders} parsed leader skills) from ${basename(inputPath)}; `
  + `copied ${copied} new thumbs.`,
);

function newestScrape(directory: string) {
  if (!existsSync(directory)) throw new Error(`No scraper data at ${directory}. Pass the character JSON path instead.`);

  // Older scrapes used a broken date format (20263125), so only accept real yyyyMMdd dates.
  const newest = readdirSync(directory)
    .filter(name => /^\d{4}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])DokkanCharacterData\.json$/.test(name))
    .sort()
    .at(-1);
  if (!newest) throw new Error(`No yyyyMMddDokkanCharacterData.json files in ${directory}.`);
  return join(directory, newest);
}
