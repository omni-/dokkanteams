// Records which cards are premium (summonable) or F2P in data/obtainment.json, using Dokkan Info.
//   npm run obtainment -- [--all] [path/to/yyyyMMddDokkanCharacterData.json]
// Looks up cards missing from the file, and rechecks ones Dokkan Info listed no banner for, unless
// --all is passed. It runs the scraper's Dokkan Info command, which needs curl on PATH (Dokkan
// Info's Cloudflare blocks Node's own requests).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { RecordedObtain, ScrapedCharacter } from '../src/core/dataset.ts';
import { newestScrape, obtainmentPath, readObtainment, scraperDirectory } from './scraper-files.ts';

const BATCH_SIZE = 100;

interface CardMeta {
  id: number;
  obtainment: 'Summonable' | 'FreeToPlay' | 'Unknown';
}

const args = process.argv.slice(2);
const refetchAll = args.includes('--all');
const inputArgument = args.find(arg => !arg.startsWith('--'));
const inputPath = inputArgument ? resolve(inputArgument) : newestScrape();

// Transformed forms come from the same card, so only base cards are looked up.
const characters = JSON.parse(readFileSync(inputPath, 'utf8')) as ScrapedCharacter[];
const ids = characters.map(character => Number(character.id)).filter(Number.isFinite);
const obtainment = readObtainment();
const wanted = refetchAll ? ids : ids.filter(id => (obtainment[String(id)] ?? 'no-banner') === 'no-banner');
console.log(`Looking up ${wanted.length} of ${ids.length} cards on Dokkan Info.`);

const tsNode = join(scraperDirectory, 'node_modules', 'ts-node', 'dist', 'bin.js');
const scratch = join(tmpdir(), `dokkan-obtainment-${process.pid}.json`);
let withoutBanner = 0;
try {
  for (let start = 0; start < wanted.length; start += BATCH_SIZE) {
    const batch = wanted.slice(start, start + BATCH_SIZE);
    execFileSync(process.execPath, [tsNode, 'dokkaninfo.ts', 'cards', '--ids', batch.join(','), '--out', scratch], {
      cwd: scraperDirectory,
      stdio: ['ignore', 'ignore', 'inherit'],
    });

    for (const card of JSON.parse(readFileSync(scratch, 'utf8')) as CardMeta[]) {
      const value: RecordedObtain = card.obtainment === 'Summonable' ? 'premium' : card.obtainment === 'FreeToPlay' ? 'f2p' : 'no-banner';
      obtainment[String(card.id)] = value;
      if (value === 'no-banner') withoutBanner++;
    }
    // Saved after every batch so a failure partway keeps what was already looked up.
    save(obtainment);
    console.log(`Saved ${Math.min(start + BATCH_SIZE, wanted.length)} of ${wanted.length}.`);
  }
} finally {
  rmSync(scratch, { force: true });
}

if (withoutBanner > 0) console.log(`${withoutBanner} cards have no summon banner on Dokkan Info; the data build counts them as F2P.`);

function save(values: Record<string, RecordedObtain>) {
  const sorted = Object.fromEntries(Object.entries(values).sort(([a], [b]) => Number(a) - Number(b)));
  mkdirSync(dirname(obtainmentPath), { recursive: true });
  writeFileSync(obtainmentPath, `${JSON.stringify(sorted, null, 2)}\n`);
}
