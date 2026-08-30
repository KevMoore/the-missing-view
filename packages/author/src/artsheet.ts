/**
 * The art sheet that ships with a drafted case.
 *
 * The generator runs at a desk over MCP, not from this process, so the CLI does
 * not make the pictures — it writes the order. Each suspect arrives with a
 * prompt already shaped to the recipe that works (`docs/art-and-music.md`), the
 * exact call to make, and the path the finished file has to land on for the
 * case to pick it up.
 *
 * The alternative was to leave a drafted case faceless and to reconstruct the
 * prompts by hand later, having forgotten what the model had in mind.
 */
import type { CasePack } from '@tmv/core';

export interface ArtPrompt {
  suspectId: string;
  name: string;
  prompt: string;
}

export function artSheet(pack: CasePack, prompts: ArtPrompt[]): string {
  const lines: string[] = [
    `# ${pack.title} — art sheet`,
    '',
    `Portraits for a drafted case. Read the case first: there is no sense painting a`,
    `cast you are about to rewrite.`,
    '',
    '## How',
    '',
    'Autosprite MCP, `generate_asset_preview`, category `character`, style `painted`,',
    'quality `ultra`. One credit each, one polished image back. The returned URL',
    'expires in about fifteen minutes, so download as you go.',
    '',
    'Then trim, downscale to 768px, JPEG quality 82, and drop each file on the path',
    'given below — the case already points at it.',
    '',
    '```bash',
    `mkdir -p apps/web/public/art/${pack.id}/cast`,
    'sips -s format jpeg -s formatOptions 82 -Z 768 <in>.png --out <path below>',
    '```',
    '',
    '## Traps, each of which has cost a regeneration',
    '',
    '- Never write "candlelit" — it renders actual candles in frame. Say "warm lamplight".',
    '- Keep every prompt under 200 characters. Longer ones are rejected outright.',
    '- Category `texture` tiles the image. `character` for people, `prop` for rooms.',
    '',
    '## The cast',
    '',
  ];

  for (const p of prompts) {
    const suspect = pack.suspects.find((s) => s.id === p.suspectId);
    lines.push(
      `### ${p.name}`,
      '',
      suspect?.publicBio ? `> ${suspect.publicBio}` : '',
      '',
      suspect?.voiceDirection ? `Sounds like: ${suspect.voiceDirection}` : '',
      '',
      `**Prompt** (${String(p.prompt.length)} chars):`,
      '',
      '```',
      p.prompt,
      '```',
      '',
      `Save to: \`apps/web/public/art/${pack.id}/cast/${p.suspectId}.jpg\``,
      '',
    );
  }

  const victim = pack.victim;
  lines.push(
    `### ${victim.name} (the victim)`,
    '',
    `> ${victim.description}`,
    '',
    '**Prompt:**',
    '',
    '```',
    victimPrompt(victim),
    '```',
    '',
    `Save to: \`apps/web/public/art/${pack.id}/cast/victim.jpg\``,
    '',
    '## Scenes',
    '',
    pack.theme
      ? `This case reuses the **${pack.theme.name}** theme, so its scenes and music already exist. Nothing to generate.`
      : 'This case has no theme yet. It needs seven scenes — lobby, three acts, the commitment, the accusation and the reveal. See `docs/art-and-music.md` for the scene prompt formula.',
    '',
  );

  return lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

function victimPrompt(v: CasePack['victim']): string {
  const p = `Oil portrait of the deceased, ${v.name}, formal period dress, stern, painted before death. Warm lamplight, umber ground. Rectangular, fills frame, no white`;
  return p.length <= 200 ? p : p.slice(0, 197) + '...';
}
