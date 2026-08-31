/**
 * The two commands around a drafted case. Kept apart from `cli.ts`, which needs
 * a model and a key; these need neither.
 */
import { findCases, list, publish } from './publish.js';
import type { CasePack } from '@tmv/core';

const [command, id] = process.argv.slice(2);

if (command === 'list') {
  list();
} else if (command === 'publish') {
  if (!id) {
    console.error('usage: pnpm case:publish <id>');
    process.exit(1);
  }
  // Load every case module so the one being published can be validated as the
  // object it actually is, rather than as text.
  const packs: Record<string, CasePack> = {};
  for (const c of findCases()) {
    const module = (await import(`../../core/src/cases/${c.file}`)) as Record<string, CasePack>;
    const pack = module[c.exportName];
    if (pack) packs[c.exportName] = pack;
  }
  publish(id, packs);
} else {
  console.error('usage: pnpm case:list | pnpm case:publish <id>');
  process.exit(1);
}
