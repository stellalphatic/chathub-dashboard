/**
 * Guardrails layered on top of the LLM router.
 *
 * These are cheap, deterministic filters that run before and after a model
 * call. They exist so a business's chatbot can never:
 *
 *   - leak system prompts / credentials,
 *   - impersonate another business ("this is ACME support" when it's Foo),
 *   - accept jailbreak instructions from an end customer,
 *   - send something insanely long or repetitive,
 *   - emit personal-attack / sexual / violent content (basic patterns only;
 *     for a full solution, add a safety model call or use OpenAI Moderation).
 *
 * For Phase 1 we keep it pragmatic: deterministic regex + length limits +
 * trigger keywords. `shouldEscalate()` returns the reason a human handoff
 * should happen (empty string if none).
 */

const JAILBREAK_PATTERNS: RegExp[] = [
  /ignore (?:all |previous )?instructions/i,
  /you are now (?:a |an )?[a-z ]+/i,
  /reveal (?:your )?system prompt/i,
  /(?:show|print|repeat) (?:the )?system prompt/i,
  /pretend (?:you are|to be)/i,
  /developer mode/i,
  /dan[_ ]mode/i,
  /jailbreak/i,
];

const CREDENTIAL_PATTERNS: RegExp[] = [
  /sk-[a-z0-9]{20,}/i, // OpenAI
  /AIzaSy[A-Za-z0-9_-]{20,}/, // Google
  /gsk_[a-z0-9]{20,}/i, // Groq
  /(?:password|api[_ ]?key|secret)\s*[:=]\s*\S{6,}/i,
];

const PROFANITY_HIGH: RegExp[] = [
  /\b(fuck(ing|er|ed)?|shit|bitch|asshole|cunt|dick)\b/i,
];

const PERSONAL_ATTACK: RegExp[] = [
  /\b(i'?ll (?:kill|hurt|find) (?:you|your)|kys|die in a )/i,
];

export type InputGuardResult = {
  blocked: boolean;
  reason?: string;
  escalate?: boolean;
  sanitized: string;
};

export function inspectInbound(text: string): InputGuardResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { blocked: true, reason: "empty", sanitized: "" };
  }
  if (trimmed.length > 4000) {
    // WhatsApp allows 4096 chars; truncate hard.
    return {
      blocked: false,
      sanitized: trimmed.slice(0, 4000) + " […truncated]",
      reason: "truncated",
    };
  }
  // Jailbreak — we don't block the customer (they'll think we're down), but
  // we do flag the message so the bot's system prompt is reinforced and the
  // reply is sanitized.
  const jailbreak = JAILBREAK_PATTERNS.some((re) => re.test(trimmed));
  if (jailbreak) {
    return {
      blocked: false,
      reason: "jailbreak_attempt",
      escalate: false,
      sanitized: trimmed,
    };
  }
  // Personal attack / abuse → escalate to a human.
  if (PERSONAL_ATTACK.some((re) => re.test(trimmed))) {
    return {
      blocked: false,
      reason: "personal_attack",
      escalate: true,
      sanitized: trimmed,
    };
  }
  return { blocked: false, sanitized: trimmed };
}

export type OutputGuardResult = {
  blocked: boolean;
  reason?: string;
  sanitized: string;
};

/**
 * Scrub model output before we hand it to a channel provider.
 *   - strip leaked API keys,
 *   - refuse to emit raw system prompts (we detect our own markers),
 *   - cap length (WhatsApp 4096; IG 1000).
 */
export function inspectOutbound(
  text: string,
  opts?: { maxLen?: number; denyWords?: string[] },
): OutputGuardResult {
  let t = (text ?? "").trim();
  if (t.length === 0) {
    return { blocked: true, reason: "empty", sanitized: "" };
  }

  for (const re of CREDENTIAL_PATTERNS) {
    if (re.test(t)) {
      t = t.replace(re, "[redacted]");
    }
  }

  if (/\[\[SYSTEM\]\]/i.test(t) || /system prompt:/i.test(t)) {
    return {
      blocked: true,
      reason: "system_prompt_leak",
      sanitized: "",
    };
  }

  if (PROFANITY_HIGH.some((re) => re.test(t))) {
    return {
      blocked: true,
      reason: "profanity",
      sanitized: "",
    };
  }

  const deny = opts?.denyWords ?? [];
  for (const w of deny) {
    if (!w) continue;
    const re = new RegExp(`\\b${escapeRegex(w)}\\b`, "i");
    if (re.test(t)) {
      return { blocked: true, reason: `deny:${w}`, sanitized: "" };
    }
  }

  const maxLen = opts?.maxLen ?? 3800;
  if (t.length > maxLen) {
    t = t.slice(0, maxLen - 1) + "…";
  }

  return { blocked: false, sanitized: t };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Intent detection — pure keyword for cheapness. Returns a reason (string) if
 * the bot should hand off, or "" to continue.
 */
export function shouldEscalate(
  text: string,
  keywords: string[],
): string | "" {
  const t = text.toLowerCase();
  for (const raw of keywords) {
    const k = raw.trim().toLowerCase();
    if (!k) continue;
    if (t.includes(k)) return `keyword:${k}`;
  }
  return "";
}
