/**
 * pnpm author --brief "a Cornish lighthouse, winter 1931"
 *
 * Drafts a case against the skeleton of one that already validates, runs the
 * validator, makes the model fix what it broke, and writes a TypeScript module
 * for a human to read. It never publishes: registering the case in the server's
 * `cases` map is a deliberate, separate act (D14).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blackwoodHall, validateCase, DECO_1920S_CHARACTERS } from '@tmv/core';
import { draftCase } from './draft.js';
import { extractSkeleton } from './skeleton.js';
import { openAiModel } from './model.js';
import { serialiseCase } from './serialise.js';
import { artSheet } from './artsheet.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const brief = arg('brief');
if (!brief) {
  console.error('usage: pnpm author --brief "a Cornish lighthouse, winter 1931" [--out <path>]');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set. Authoring needs a live model.');
  process.exit(1);
}

const skeleton = extractSkeleton(blackwoodHall);
console.log(
  `Skeleton: ${String(skeleton.suspectCount)} suspects, ${String(skeleton.clues.length)} clues, ` +
    `${String(skeleton.clues.filter((c) => c.probative).length)} of them probative.`,
);

const { pack, issues, attempts, art } = await draftCase({
  skeleton,
  brief,
  ...(blackwoodHall.theme ? { theme: blackwoodHall.theme } : {}),
  characters: DECO_1920S_CHARACTERS,
  model: openAiModel(),
  onProgress: (m) => {
    console.log(`  ${m}…`);
  },
});

if (issues.length > 0) {
  console.error(`\nRejected after ${String(attempts)} attempt(s). The validator still says:`);
  for (const i of issues) console.error(`  [${i.rule}] ${i.message}`);
  console.error('\nNot written. Re-run, or adjust the brief.');
  process.exit(1);
}

const exportName = pack.id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

// Anchored to this file, not the shell's working directory. pnpm runs this from
// inside the package and a person runs it from the repo root, and a relative
// path threw away four model calls' worth of work the first time it was used.
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const asked = arg('out');
const out = asked
  ? isAbsolute(asked)
    ? asked
    : resolve(process.cwd(), asked)
  : resolve(repoRoot, 'packages/core/src/cases', `${pack.id}.ts`);
const artOut = out.replace(/\.ts$/, '.art.md');

// Write before anything else can fail. A drafted case is minutes of model time
// and real money; it does not get lost because a later line threw.
try {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, serialiseCase(pack, brief, exportName));
  writeFileSync(artOut, artSheet(pack, art));
} catch (err) {
  const rescue = resolve(repoRoot, `drafted-${pack.id}.json`);
  writeFileSync(rescue, JSON.stringify({ brief, pack, art }, null, 2));
  console.error(`\nCould not write to ${out}: ${String(err)}`);
  console.error(`The draft itself is safe at ${rescue} — it does not need generating again.`);
  process.exit(1);
}

console.log(`\n"${pack.title}" — validator clean after ${String(attempts)} attempt(s).`);
console.log(`Written to ${out}`);
console.log(`Art sheet   ${artOut} — ${String(art.length + 1)} portraits to generate`);
console.log('\nIt is drafted, not published. Read it, then register it in the server to play it.');

// Belt and braces: prove what we wrote still validates, not merely what we held.
if (validateCase(pack).length > 0) {
  console.error('The written pack no longer validates. This is a bug in the author.');
  process.exit(1);
}
