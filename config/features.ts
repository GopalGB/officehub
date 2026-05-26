// Feature flag registry.
// Toggle anything in here via env var. Defaults are production-sane.
// Documented in .env.example.

function env(key: string, fallback: string): string {
  return (typeof process !== "undefined" && process.env?.[key]) || fallback;
}

function bool(key: string, fallback: boolean): boolean {
  const v = env(key, fallback ? "true" : "false").toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export const features = {
  // ───── core ─────
  signupOpen: {
    enabled: env("SIGNUP_POLICY", "closed") === "open",
    label: "Open self-signup",
    description: "Anyone with the URL can register. Otherwise admin-only via invite link.",
  },

  // ───── product surfaces ─────
  tasks: {
    enabled: bool("FEATURE_TASKS", true),
    label: "Tasks (Jira-style)",
    description: "Backlog + Kanban for tasks within projects.",
  },
  wiki: {
    enabled: bool("FEATURE_WIKI", true),
    label: "Wiki (Notion-style)",
    description: "Free-form pages with BlockNote editor + page tree.",
  },
  calendar: {
    enabled: bool("FEATURE_CALENDAR", true),
    label: "Calendar",
    description: "Month grid showing milestones + tasks by due date.",
  },
  projectBoard: {
    enabled: bool("FEATURE_PROJECT_BOARD", true),
    label: "Project Kanban board",
    description: "Kanban view across projects (grouped by status).",
  },
  favorites: {
    enabled: bool("FEATURE_FAVORITES", true),
    label: "Project favorites",
    description: "Pin projects to the top of dashboard.",
  },
  enhancements: {
    enabled: bool("FEATURE_ENHANCEMENTS", true),
    label: "Enhancement proposals",
    description: "Track improvement ideas per project with status workflow.",
  },
  comments: {
    enabled: bool("FEATURE_COMMENTS", true),
    label: "Comments on projects",
    description: "Lightweight discussion threads.",
  },
  tags: {
    enabled: bool("FEATURE_TAGS", true),
    label: "Tags",
    description: "Colored labels across projects (starter set seeded).",
  },

  // ───── workflow ─────
  cmdK: {
    enabled: bool("FEATURE_CMD_K", true),
    label: "⌘K command palette",
    description: "Global search + quick jump (Cmd/Ctrl + K).",
  },
  invitations: {
    enabled: bool("FEATURE_INVITATIONS", true),
    label: "Invitation links",
    description: "Admin creates 14-day invite URLs for teammates.",
  },
  directPasswordCreate: {
    enabled: bool("FEATURE_DIRECT_PASSWORD", true),
    label: "Admin sets password directly",
    description: "Alternate to invite links — admin types a password inline.",
  },

  // ───── deferred ─────
  fileAttachments: {
    enabled: bool("FEATURE_ATTACHMENTS", false),
    label: "File attachments",
    description: "Upload files to projects + comments. Backend ready; UI pending.",
  },
  auditLog: {
    enabled: bool("FEATURE_AUDIT_LOG", false),
    label: "Audit log",
    description: "AuditLog model wired into every mutation + admin viewer.",
  },
  sso: {
    enabled: bool("FEATURE_SSO", false),
    label: "Single Sign-On",
    description: "OIDC providers via Auth.js. Add provider in auth.ts.",
  },
  emailDigests: {
    enabled: bool("FEATURE_EMAIL_DIGESTS", false),
    label: "Daily/weekly email digests",
    description: "Overdue + due-soon summary via SMTP.",
  },
  sprints: {
    enabled: bool("FEATURE_SPRINTS", false),
    label: "Sprints",
    description: "Time-boxed task groups. Schema not yet added.",
  },
  realTimeCollab: {
    enabled: bool("FEATURE_REALTIME", false),
    label: "Real-time collaborative editing",
    description: "Yjs sync over WebSockets. Adds Redis dependency.",
  },

  // ───── branding ─────
  whiteLabel: {
    enabled: bool("FEATURE_WHITELABEL", false),
    label: "White-label mode",
    description: "Replace app name + logo + accent color from env vars.",
  },
} as const;

export type FeatureKey = keyof typeof features;

/**
 * Server-safe feature check. Use in server components, server actions, API routes.
 * Throws if the feature key is unknown.
 */
export function isFeatureEnabled(key: FeatureKey): boolean {
  const f = features[key];
  if (!f) throw new Error(`Unknown feature flag: ${key}`);
  return f.enabled;
}

/**
 * For client components: serialize the current flag state at the page level
 * (in a server component) and pass it down via props. Don't read process.env in
 * client code.
 */
export function snapshotFeatures(): Record<FeatureKey, boolean> {
  const out = {} as Record<FeatureKey, boolean>;
  for (const k of Object.keys(features) as FeatureKey[]) {
    out[k] = features[k].enabled;
  }
  return out;
}
