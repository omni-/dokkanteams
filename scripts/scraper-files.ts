// Where the data scripts find DokkanWebScraper's output and this repo's own data files.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RecordedObtain } from '../src/core/dataset.ts';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const scraperDirectory = resolve(root, '../DokkanWebScraper');
export const obtainmentPath = join(root, 'data', 'obtainment.json');

/** The newest yyyyMMddDokkanCharacterData.json in the scraper's data folder. */
export function newestScrape(directory = join(scraperDirectory, 'data')): string {
  if (!existsSync(directory)) throw new Error(`No scraper data at ${directory}. Pass the character JSON path instead.`);

  // Older scrapes used a broken date format (20263125), so only accept real yyyyMMdd dates.
  const newest = readdirSync(directory)
    .filter(name => /^\d{4}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])DokkanCharacterData\.json$/.test(name))
    .sort()
    .at(-1);
  if (!newest) throw new Error(`No yyyyMMddDokkanCharacterData.json files in ${directory}.`);
  return join(directory, newest);
}

/** Card id → what Dokkan Info said, as recorded by `npm run obtainment`. */
export function readObtainment(): Record<string, RecordedObtain> {
  if (!existsSync(obtainmentPath)) return {};
  return JSON.parse(readFileSync(obtainmentPath, 'utf8')) as Record<string, RecordedObtain>;
}
