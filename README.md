# Pantheon Forge

A local-first AI agent platform for personal productivity. Pantheon Forge combines a Tauri desktop shell, a Next.js frontend, and a Rust backend so users can work with specialized agents while keeping conversations and credentials on-device.

## Features

- **Specialized Agents**: Software Engineer and Cybersecurity Specialist personas are available today through shared agent metadata.
- **Streaming Desktop Chat**: Tauri-backed chat UI with persisted conversations, agent-aware prompts, and provider selection.
- **Pluggable Providers**: Anthropic, OpenAI, and DeepSeek are available now. Google and Ollama remain visible as planned integrations.
- **Local Persistence**: SQLite stores conversations and app settings locally.
- **Secure Credential Storage**: Provider credentials live in the OS keyring instead of SQLite or the repository.
- **Cyberpunk Interface**: Tailwind-powered sci-fi styling with shared UI tokens and reusable components.

## Tech Stack

- **Frontend**: Next.js 16 App Router + React 19 + TypeScript
- **Desktop**: Tauri 2 with a Rust IPC/backend layer
- **Database**: SQLite via SQLx migrations
- **Credentials**: OS keyring integration via `keyring`
- **Build**: pnpm workspaces + Turbo

## Development

```bash
# Install dependencies
pnpm install

# Run the desktop web app in the browser
cd apps/desktop
pnpm dev

# Run the full Tauri desktop app
cd apps/desktop
pnpm tauri:dev

# Build the workspace
pnpm build

# Lint the workspace
pnpm lint
```

## Project Structure

```text
pantheon-forge/
├── apps/desktop/          # Tauri + Next.js desktop app
├── packages/
│   ├── agent-types/       # Shared TypeScript interfaces and provider metadata
│   ├── agent-registry/    # Agent definitions + browser-safe static exports
│   ├── ui/                # Shared React components + theme primitives
│   └── crypto/            # Reserved client-side crypto utilities
├── tasks/                 # Project tracking notes
└── ultron.md              # Architecture plan and implementation direction
```

## Current Status

- Phase 2 agent-system work is complete.
- The current stabilization pass keeps build/lint green, normalizes legacy message-role data, and makes provider status truthful in the UI.
- Phase 3 tool execution and manual approval workflows are planned, but not implemented yet.

## License

MIT
