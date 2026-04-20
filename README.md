# Pantheon Forge

Pantheon Forge is a local-first desktop AI agent workspace. It combines a
Next.js frontend, a Tauri desktop shell, and a Rust backend so you can chat
with specialized agents while keeping conversations and provider credentials
on your own machine.

Today, the project is best understood as a polished desktop command surface
for agent-driven chat, provider routing, approval-gated tools, and local
persistence. It is not yet a broad autonomous agent platform with unrestricted
tooling or provider parity across every planned integration.

## What It Does Today

Pantheon Forge currently ships three core desktop surfaces:

- `Launchpad`: pick an agent, see provider readiness, and jump back into recent work
- `Chat Workspace`: hold streaming conversations with a selected agent and route messages through a configured provider
- `Provider Settings`: manage available providers, default models, and roadmap-only integrations

Implemented capabilities:

- `Local-first desktop app`: Tauri 2 shell with a Next.js 16 App Router frontend
- `Specialized agents`: shared agent registry with Software Engineer and Cybersecurity Specialist definitions
- `Streaming chat`: provider-backed message streaming with persisted conversations
- `Provider routing`: Anthropic, OpenAI, and DeepSeek are usable today
- `Approved tool execution`: project-scoped `read-file`, `search-files`, `write-file`, and curated `execute-command`
- `Manual approvals`: every tool request is previewed and requires explicit user approval
- `Project-scoped access`: conversations bind one remembered project grant at a time
- `Tool audit trail`: tool executions are persisted and surfaced inline in chat plus Settings
- `Truthful provider status`: Google and Ollama remain visible, but clearly marked as planned
- `Local persistence`: SQLite stores conversations and app-level state
- `Secure credentials`: API keys live in the OS keyring, not in SQLite
- `Unified shell`: launchpad, chat, and settings share the same desktop UI system

## What It Does Not Do Yet

These pieces are planned, but not implemented as product-ready features yet:

- multi-agent orchestration beyond selecting different specialist personas
- broader tool coverage beyond the current read/write/search/curated-command set
- specialist-only tools like dependency analysis and network scanning
- broad provider coverage beyond the currently wired providers

If you are looking for the architectural direction behind those future phases,
see [ultron.md](./ultron.md).

## Product Snapshot

Pantheon Forge is designed around a desktop-first workflow:

- `Launchpad` is the entry surface for orientation and agent selection
- `Chat` is the main working surface, with conversations, streaming responses, provider-aware routing, and approval-gated tool use
- `Settings` is where credentials, project grants, and tool control are managed

The UI is intentionally local-app oriented rather than web-dashboard oriented:
it uses a unified shell, a mature cyberpunk visual system, and a Tauri-native
window shell.

## Architecture

High-level stack:

- `Frontend`: Next.js 16, React 19, TypeScript, Tailwind CSS v4
- `Desktop shell`: Tauri 2
- `Backend`: Rust IPC commands, provider gateway logic, SQLite storage
- `State`: Zustand on the frontend
- `Credentials`: OS keyring via Rust
- `Workspace tooling`: pnpm workspaces + Turbo

Runtime model:

1. The Next.js app renders the desktop UI.
2. Frontend stores coordinate agent selection, chat state, settings, and conversations.
3. Tauri IPC bridges frontend actions into Rust commands.
4. Rust manages provider requests, streaming events, local SQLite storage, and OS-keyring credentials.

## Providers

Current provider status:

| Provider | Status | Notes |
| --- | --- | --- |
| Anthropic | Available | Fully configurable in Settings |
| OpenAI | Available | Fully configurable in Settings |
| DeepSeek | Available | Routed through the OpenAI-compatible path |
| Google | Planned | Visible in UI, not configurable |
| Ollama | Planned | Visible in UI, not configurable |

## Agents

Current bundled agents:

- `Software Engineer`
- `Cybersecurity Specialist`

These agents are data-driven and come from the shared agent registry package.
The desktop app consumes the same shared metadata used across the workspace.

## Repository Layout

```text
ultron/
├── apps/
│   └── desktop/                 # Next.js + Tauri desktop app
│       ├── app/                 # App Router routes
│       ├── components/          # Chat, settings, and shell UI
│       ├── lib/                 # Tauri bridge and frontend helpers
│       ├── stores/              # Zustand state stores
│       └── src-tauri/           # Rust backend, capabilities, migrations
├── packages/
│   ├── agent-registry/          # Agent definitions and loaders
│   ├── agent-types/             # Shared agent/provider types
│   ├── crypto/                  # Reserved shared crypto helpers
│   └── ui/                      # Shared UI primitives
├── tasks/                       # Project tracking notes
├── ultron.md                    # Architecture and roadmap direction
└── README.md
```

## Getting Started

### Prerequisites

- Node.js `20+`
- `pnpm` `10.x`
- Rust toolchain for the Tauri app
- Platform dependencies required by Tauri on your OS

### Install

```bash
pnpm install
```

## Running The Project

From the repo root:

```bash
# Run workspace dev tasks
pnpm dev

# Lint the workspace
pnpm lint

# Build the workspace
pnpm build
```

From the desktop app package:

```bash
cd apps/desktop

# Run the UI in the browser
pnpm dev

# Run the native Tauri desktop app
pnpm tauri:dev

# Production build of the desktop frontend
pnpm build

# Build the packaged Tauri app
pnpm tauri:build
```

## Development Notes

- The desktop app currently builds with `next build --webpack`.
- Provider credentials are stored in the OS keyring, not the repository or SQLite.
- Conversation history persists locally in SQLite.
- The current UI shell has already been through stabilization and desktop-polish passes.
- The app is optimized first for a roomy desktop workflow; mobile is not the target.

## Current State

Pantheon Forge is in a strong prototype-to-product transition phase.

What is stable now:

- desktop shell architecture
- provider settings flow
- persisted chat conversations
- agent registry integration
- project-scoped tool execution with approval
- global tool execution history and control-plane UI
- truthful provider availability in the UI
- local credential handling

What is next:

- Phase 4 provider expansion
- specialist-only tool additions
- deeper agent execution capabilities beyond the curated tool set

## Why This Repo Exists

The project is aiming for a desktop-native agent environment where:

- the user owns the runtime and the data
- agent personas are explicit and inspectable
- provider credentials stay local
- tool execution happens inside a safer, approval-oriented shell

The current codebase already delivers the local workspace and provider/chat
foundation that those later capabilities will build on.

## License

MIT
