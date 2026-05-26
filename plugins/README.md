# Plugins

OfficeHub supports a lightweight plugin convention so you can add functionality without forking the core.

> **Status:** scaffolding. The plugin runtime ships in v2.0. This README documents the design contract so AI agents and contributors can start building plugins now; loader lands in a follow-up phase.

---

## Plugin shape

Every plugin is a folder under `plugins/<your-plugin-name>/`:

```
plugins/<your-plugin-name>/
├── plugin.json           # manifest
├── server.ts             # server-side hooks (runs in Next.js server runtime)
├── client.ts             # client-side React components (optional)
└── README.md             # what it does, how to install, env vars needed
```

## `plugin.json` manifest

```json
{
  "name": "slack-notify",
  "version": "0.1.0",
  "description": "Posts a Slack message when a project status changes.",
  "author": "you",
  "license": "MIT",
  "officehubVersion": "^2.0.0",
  "hooks": [
    "onProjectUpdate",
    "onTaskStatusChange"
  ],
  "envVars": [
    {
      "name": "SLACK_WEBHOOK_URL",
      "required": true,
      "description": "Incoming webhook URL from Slack app"
    }
  ],
  "ui": {
    "settingsPage": true
  }
}
```

## Lifecycle hooks

```typescript
// plugins/<name>/server.ts
import type { PluginContext } from "@/lib/plugins/types";

export async function onInstall(ctx: PluginContext) {
  // Migrations, env var validation, initial setup
}

export async function onEnable(ctx: PluginContext) {
  // Called when admin toggles the plugin on for the workspace
}

export async function onDisable(ctx: PluginContext) {
  // Clean up: stop background jobs, unsubscribe webhooks
}

export async function onTeardown(ctx: PluginContext) {
  // Plugin is being uninstalled — drop tables, delete files
}

// Event hooks (subscribed via plugin.json `hooks` array)
export async function onProjectUpdate(payload: ProjectUpdatePayload, ctx: PluginContext) {
  const url = ctx.env("SLACK_WEBHOOK_URL");
  await fetch(url, {
    method: "POST",
    body: JSON.stringify({ text: `${payload.author.name} updated ${payload.project.title}` }),
  });
}
```

## Available events (planned)

| Event | Payload | When |
|---|---|---|
| `onProjectCreate` | `{ project, user }` | After a project is created |
| `onProjectUpdate` | `{ project, changes, user }` | After any project field changes |
| `onProjectStatusChange` | `{ project, oldStatus, newStatus, user }` | Status field changes specifically |
| `onTaskCreate` | `{ task, project, user }` | After task creation |
| `onTaskStatusChange` | `{ task, project, oldStatus, newStatus, user }` | Task status changes |
| `onTaskAssign` | `{ task, project, oldAssignee, newAssignee, user }` | Task assignee changes |
| `onUserCreate` | `{ user, invitedBy }` | New user added (via invite or direct create) |
| `onComment` | `{ comment, project, user }` | New comment posted |

## Settings UI (optional)

If `plugin.json` has `"ui": { "settingsPage": true }`, the plugin can render a settings card on `/dashboard/settings`:

```typescript
// plugins/<name>/client.ts
"use client";

export function SettingsCard() {
  return (
    <div>
      <h3>Slack notifications</h3>
      <p>Status: connected · last fired 2h ago</p>
      <button>Send test message</button>
    </div>
  );
}
```

## Reference plugins (shipping in v2.1)

These will live in `plugins/` and be enabled by default — they're the canonical "how to build a plugin" examples:

| Plugin | Purpose |
|---|---|
| `slack-notify` | Status updates → Slack channel |
| `github-issues-sync` | Two-way sync: OfficeHub tasks ↔ GitHub issues |
| `calendar-feed` | iCal feed of milestones + tasks |
| `daily-digest` | Email digest of overdue + due-soon items |

## Building a plugin

Until the runtime ships:

1. Create `plugins/<name>/` with the files above
2. Write `plugin.json` + `server.ts` per the contract
3. For now, manually wire your event handlers by importing them from the relevant server actions (e.g. `import { onProjectUpdate } from "../../plugins/slack-notify/server"`)
4. Once the runtime ships, the loader handles this automatically

## Versioning

- `officehubVersion` in your manifest uses semver ranges (`^2.0.0`, `>=2.1.0 <3.0.0`)
- The plugin loader will refuse to load plugins with incompatible version ranges
- Breaking changes to the hook API bump OfficeHub's major version

## Security

- Plugins run **in the same process** as OfficeHub. They have full DB + env access.
- Only install plugins you trust or have audited.
- B2B operators: review any third-party plugin code before enabling on customer data.

## Publishing

When the marketplace lands (v2.2+), publish via:
```bash
officehub plugin publish
```

For now: share your plugin as a GitHub repo. Document install in your README.
