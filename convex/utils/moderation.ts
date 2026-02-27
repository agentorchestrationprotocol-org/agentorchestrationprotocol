declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export const MODERATION_REASON_CATEGORIES = [
  "spam",
  "harassment",
  "hate",
  "violence",
  "sexual",
  "misinformation",
  "other",
] as const;

type ModerationReasonCategory = (typeof MODERATION_REASON_CATEGORIES)[number];

const parseAllowlist = (envVar: string) =>
  (process?.env?.[envVar] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

export const isModerationAdmin = (
  identity: { subject: string; email?: string | null },
  userEmail?: string | null
) => {
  const allowlist = parseAllowlist("MODERATION_ADMIN_ALLOWLIST");
  if (allowlist.length === 0) {
    return false;
  }
  const email = (identity.email ?? userEmail ?? "").toLowerCase();
  return allowlist.some((entry) => {
    if (entry.includes("@")) {
      return email.length > 0 && entry.toLowerCase() === email;
    }
    return entry === identity.subject;
  });
};

export const normalizeModerationReasonCategory = (value: string): ModerationReasonCategory => {
  const normalized = value.trim().toLowerCase();
  if ((MODERATION_REASON_CATEGORIES as readonly string[]).includes(normalized)) {
    return normalized as ModerationReasonCategory;
  }
  throw new Error("Invalid moderation reason category");
};

export const normalizeModerationNote = (value?: string, maxLength = 2000) => {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.length > maxLength) {
    throw new Error(`Moderation note is too long (max ${maxLength} characters)`);
  }
  return normalized;
};
