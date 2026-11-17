// Neon Bay — the entrypoint for make.fun's gta6-01 bounty (Node 22,
// standard library only). It stages the game for the grader: copy this
// repo's game/ and screenshots/ into the output directory and write the
// dossier.json the judge reads, using the vendored make.fun library.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function stageFolder(name) {
  const from = join(repoRoot, name);
  const to = join(outputDir, name);
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

// The scorer's own caps (gate.json): only text_max_bytes shapes the
// dossier's bytes; the rest refuse an entry the scorer would refuse —
// more than 4 screenshots or one over 256 KiB, more than 993 entries in
// game/ or 48 MiB of game files, or a game path over 1000 bytes.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(outputDir, { recursive: true });
stageFolder('game');
stageFolder('screenshots');

const dossier = buildDossier(outputDir, DOSSIER_CAPS);
writeFileSync(join(outputDir, 'dossier.json'), dossier);

// One line of proof the staging ran: the grader's two runs must agree.
console.log(`Neon Bay staged: ${dossier.length} dossier bytes in ${outputDir}`);
