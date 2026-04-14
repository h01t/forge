# Pantheon Forge

A local-first AI agent platform for personal productivity. Summon specialized AI agents that can collaborate to solve complex tasks.

## Features

- **Multiple Specialized Agents**: Software Engineer, Cybersecurity Specialist, and more
- **Agent Collaboration**: Agents can delegate tasks and hand off to each other
- **Pluggable LLM Providers**: Support for Anthropic Claude, OpenAI GPT, Google Gemini, DeepSeek
- **Secure & Private**: Local-first execution with encrypted credential storage
- **Manual Approval**: All tool executions require user approval
- **Sci-Fi/Cyberpunk UI**: Immersive visual experience

## Tech Stack

- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Desktop**: Tauri (Rust backend)
- **Database**: SQLite with SQLCipher encryption
- **Build**: pnpm workspaces + Turbo

## Development

```bash
# Install dependencies
pnpm install

# Run development server (web only)
cd apps/desktop
npm run dev

# Run Tauri app
cd apps/desktop
npm run tauri:dev

# Build for production
pnpm build
```

## Project Structure

```
pantheon-forge/
├── apps/desktop/          # Tauri + Next.js desktop app
├── packages/
│   ├── agent-types/       # Shared TypeScript interfaces
│   ├── agent-registry/    # Agent definitions (YAML + TS)
│   ├── ui/                # Shared React components + theme
│   └── crypto/            # Encryption utilities
```

## License

MIT
