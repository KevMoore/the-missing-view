/**
 * The cases a room may actually be dealt.
 *
 * Drafting a case writes a file (`pnpm author`). Appearing in *this list* is
 * what makes it playable, and that stays a deliberate human act — D14: LLM
 * drafts, validator gates, a person publishes. The validator can prove a
 * mystery is sound; it cannot tell you whether it is any good, and only a
 * person who has read it can.
 *
 * `pnpm case:publish <id>` edits this file for you, having first made you
 * confirm you have read the draft.
 */
import type { CasePack } from '../case/types.js';
import { blackwoodHall } from './blackwood-hall.js';

export const PUBLISHED_CASES: CasePack[] = [blackwoodHall];

/** Keyed by id, for the server's room creation. */
export function publishedCases(): Map<string, CasePack> {
  return new Map(PUBLISHED_CASES.map((c) => [c.id, c]));
}
