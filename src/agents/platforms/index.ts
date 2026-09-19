import type { Draft, PlatformId } from "@/shared/types";
import { xPlaybook } from "./x";
import { linkedinPlaybook } from "./linkedin";
import { instagramPlaybook } from "./instagram";
import { threadsPlaybook } from "./threads";
import { facebookPlaybook } from "./facebook";
import type { PlatformPlaybook } from "./types";

export type { PlatformPlaybook } from "./types";

/** Registry of every known platform playbook, including disabled ones. */
export const PLATFORM_PLAYBOOKS: Record<PlatformId, PlatformPlaybook> = {
  x: xPlaybook,
  linkedin: linkedinPlaybook,
  instagram: instagramPlaybook,
  threads: threadsPlaybook,
  facebook: facebookPlaybook,
};

/** Playbooks for platforms the orchestrator is currently allowed to use. */
export function getEnabledPlaybooks(): PlatformPlaybook[] {
  return Object.values(PLATFORM_PLAYBOOKS).filter((p) => p.enabled);
}

export interface DraftValidationResult {
  valid: boolean;
  errors: string[];
}

function normalizeTag(tag: string): string {
  const bare = tag.trim().replace(/^#+/, "");
  return bare ? `#${bare}` : "";
}

/**
 * The exact text that would be posted: body plus hashtags. The DB stores
 * them separately; compose at validate/publish time.
 */
export function composePost(draft: Draft): string {
  const tags = draft.hashtags.map(normalizeTag).filter(Boolean);
  if (tags.length === 0) return draft.body.trim();
  return `${draft.body.trim()}\n\n${tags.join(" ")}`;
}

/**
 * Hard gate on platform limits: character count and hashtag count.
 * This runs in plain code, before the critic's opinion counts for
 * anything — the model doesn't get to argue a post under the limit.
 */
export function validateDraft(
  platformId: PlatformId,
  text: string,
  hashtags: string[] = [],
): DraftValidationResult {
  const playbook = PLATFORM_PLAYBOOKS[platformId];
  const errors: string[] = [];

  if (!playbook.enabled) {
    errors.push(`Platform "${platformId}" is not enabled.`);
  }
  if (text.length > playbook.maxChars) {
    errors.push(
      `${text.length}/${playbook.maxChars} characters — shorten by ${text.length - playbook.maxChars}`,
    );
  }
  if (hashtags.length > playbook.maxHashtags) {
    errors.push(
      `${hashtags.length}/${playbook.maxHashtags} hashtags — remove ${hashtags.length - playbook.maxHashtags}`,
    );
  }
  // Note: instagram's requiresImage can't be gated here — drafts have no
  // image yet. Add that check when image production lands.

  return { valid: errors.length === 0, errors };
}
