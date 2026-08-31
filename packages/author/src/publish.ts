/**
 * pnpm case:list              — what exists, and what a room can be dealt
 * pnpm case:publish <id>      — make a drafted case playable
 *
 * Publication is a human act (D14). This script does not decide anything; it
 * does the two lines of editing that stand between a case you have read and a
 * case a room can be given, and it refuses to do them for a case that does not
 * validate.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCase, PUBLISHED_CASES, type CasePack } from '@tmv/core';

// Anchored to this file, not to the shell's working directory: pnpm runs these
// from inside the package, and a person runs them from the repo root.
const CASES_DIR = fileURLToPath(new URL('../../core/src/cases', import.meta.url));
const REGISTRY = join(CASES_DIR, 'published.ts');

interface Drafted {
  id: string;
  file: string;
  exportName: string;
  published: boolean;
}

/** Every case file on disk, and whether a room can currently be dealt it. */
export function findCases(): Drafted[] {
  const published = new Set(PUBLISHED_CASES.map((c) => c.id));
  return readdirSync(CASES_DIR)
    .filter((f) => f.endsWith('.ts') && f !== 'published.ts')
    .map((file) => {
      const source = readFileSync(join(CASES_DIR, file), 'utf8');
      const exportName = /export const (\w+): CasePack/.exec(source)?.[1] ?? '';
      const id = /\bid: '([^']+)'/.exec(source)?.[1] ?? file.replace(/\.ts$/, '');
      return { id, file, exportName, published: published.has(id) };
    })
    .filter((c) => c.exportName !== '');
}

export function list(): void {
  const cases = findCases();
  if (cases.length === 0) {
    console.log('No cases. Draft one with: pnpm author --brief "…"');
    return;
  }
  console.log('');
  for (const c of cases) {
    console.log(
      `  ${c.published ? '●' : '○'}  ${c.id.padEnd(28)} packages/core/src/cases/${c.file}`,
    );
  }
  console.log('\n  ● playable    ○ drafted, not yet published');
  if (cases.some((c) => !c.published)) {
    console.log('\n  Read a draft, then: pnpm case:publish <id>');
  }
  console.log('');
}

/** Add a drafted case to the registry, once it has been read and it validates. */
export function publish(id: string, packs: Record<string, CasePack>): void {
  const target = findCases().find((c) => c.id === id);
  if (!target) {
    console.error(`No case with id "${id}". Try: pnpm case:list`);
    process.exit(1);
  }
  if (target.published) {
    console.log(`"${id}" is already playable.`);
    return;
  }

  const pack = packs[target.exportName];
  if (!pack) {
    console.error(`Could not load ${target.exportName} from ${target.file}.`);
    process.exit(1);
  }

  // The gate is the point. A case that fails here would break a real session.
  const issues = validateCase(pack);
  if (issues.length > 0) {
    console.error(`\n"${id}" does not validate, so it cannot be published:\n`);
    for (const i of issues) console.error(`  [${i.rule}] ${i.message}`);
    console.error('');
    process.exit(1);
  }

  const source = readFileSync(REGISTRY, 'utf8');
  const importLine = `import { ${target.exportName} } from './${target.file.replace(/\.ts$/, '.js')}';`;
  const updated = source
    .replace(/(import \{ blackwoodHall \} from '\.\/blackwood-hall\.js';)/, `$1\n${importLine}`)
    .replace(
      /export const PUBLISHED_CASES: CasePack\[\] = \[([^\]]*)\];/,
      (_, inner: string) =>
        `export const PUBLISHED_CASES: CasePack[] = [${inner.trim().replace(/,$/, '')}, ${target.exportName}];`,
    );
  writeFileSync(REGISTRY, updated);

  console.log(`\n"${pack.title}" is now playable.`);
  console.log(`  ${String(pack.suspects.length)} suspects · ${String(pack.clues.length)} clues`);
  console.log('\nRestart the server and it will appear in the facilitator console.\n');
}
