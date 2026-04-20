# Pantheon Forge - AI Agent Platform Architecture Plan

## Executive Summary

Pantheon Forge is a local-first AI agent platform featuring a sci-fi/cyberpunk aesthetic, built with Next.js, TypeScript, and delivered as a desktop application. The platform enables users to summon specialized AI agents that can collaborate with each other while maintaining full control through a manual approval workflow for all tool executions.

## 1. Desktop Delivery Decision: Tauri

### Recommendation: **Tauri**

After careful consideration of both options, **Tauri** is recommended for Pantheon Forge for the following reasons:

| Aspect | Tauri | Electron |
|--------|-------|----------|
| **Bundle Size** | 3-10MB | 100-200MB+ |
| **Security** | Superior - Rust backend, minimal attack surface | Larger attack surface (Node.js + Chromium) |
| **TypeScript Support** | Full (via tauri-plugin) | Native |
| **Memory Usage** | ~50-70% of Electron | Higher baseline |
| **Tooling** | Tauri CLI, Rust toolchain | Electron Builder |
| **Performance** | Uses system WebView (native feel) | Full Chromium (consistent cross-platform) |

### Key Advantages for Pantheon Forge:
1. **Security**: Critical for an app that executes local commands - Rust's memory safety and minimal attack surface
2. **Bundle Size**: Users expect modern apps to be lightweight
3. **Performance**: Lower memory usage allows more resources for AI agent execution
4. **System Integration**: Better native feel with system WebView

### Trade-offs:
- Requires Rust toolchain setup (one-time cost)
- Smaller ecosystem than Electron (but growing rapidly)
- Learning curve for Tauri-specific patterns

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Tauri Desktop App                              │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    Next.js Frontend (React)                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │ │
│  │  │   Chat UI    │  │ Task Runner  │  │  Settings    │             │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │              Sci-Fi/Cyberpunk Theme System                    │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                │ IPC                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    Tauri Backend (Rust)                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │ │
│  │  │  Agent Core  │  │ LLM Gateway  │  │ Tool Broker  │             │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │               OS Keyring + SQLite Storage                     │  │ │
│  │  │  (Keyring: API keys · SQLite: Conversations, Settings)        │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                │                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      System Integration                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │ │
│  │  │  File System │  │   Terminal   │  │ Web Browser  │             │ │
│  │  │   (approved) │  │  (approved)  │  │  (approved)  │             │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Description

#### Frontend (Next.js + React)
- **Chat UI**: Main interface for agent interaction with message history
- **Task Runner**: Dashboard for monitoring and managing multi-agent tasks
- **Settings UI**: Configure LLM providers, manage agents, security settings
- **Theme System**: Comprehensive sci-fi/cyberpunk styling with animations

#### Backend (Tauri + Rust)
- **Agent Core**: Data-driven agent registry, system prompt injection, tool filtering
- **LLM Gateway**: Provider abstraction layer, credential management via OS keyring
- **Tool Broker**: Tool execution with approval workflow
- **Storage Layer**: SQLite for conversations/settings, OS keyring for credentials

## 3. Directory Structure

### Actual: Monorepo with pnpm Workspaces

```
pantheon-forge/
├── apps/
│   └── desktop/                        # Tauri app
│       ├── app/                         # Next.js App Router (no src/ wrapper)
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── globals.css
│       │   ├── manifest.json
│       │   ├── chat/
│       │   │   └── page.tsx
│       │   └── settings/
│       │       └── page.tsx
│       ├── components/                  # React components
│       │   ├── TauriGuard.tsx
│       │   ├── chat/
│       │   │   ├── ChatInterface.tsx
│       │   │   ├── ChatInput.tsx
│       │   │   ├── ChatMessage.tsx
│       │   │   ├── ConversationList.tsx
│       │   │   └── StreamingIndicator.tsx
│       │   └── settings/
│       │       ├── SettingsLayout.tsx
│       │       └── ProviderForm.tsx
│       ├── lib/                         # Frontend utilities
│       │   ├── tauri.ts                # Tauri IPC bridge + invoke wrappers
│       │   └── streaming.ts            # Streaming event listener
│       ├── stores/                      # Zustand state management
│       │   ├── chat.ts
│       │   ├── conversations.ts
│       │   └── settings.ts
│       ├── public/
│       ├── next.config.ts
│       ├── postcss.config.mjs
│       ├── eslint.config.mjs
│       ├── tsconfig.json
│       ├── package.json
│       └── AGENTS.md
│
│       ├── src-tauri/                   # Rust backend
│       │   ├── src/
│       │   │   ├── main.rs             # Binary entry point
│       │   │   ├── lib.rs              # App setup + IPC command registration
│       │   │   ├── llm/                # LLM gateway
│       │   │   │   ├── mod.rs
│       │   │   │   ├── types.rs
│       │   │   │   ├── registry.rs     # ProviderFactory + LLMProvider trait
│       │   │   │   ├── anthropic.rs
│       │   │   │   └── openai.rs
│       │   │   ├── credentials/        # OS keyring credential storage
│       │   │   │   └── mod.rs
│       │   │   ├── storage/            # SQLite layer
│       │   │   │   └── mod.rs
│       │   │   ├── crypto/             # AES-256-GCM encryption utils
│       │   │   │   └── mod.rs
│       │   │   └── migrations/         # SQLx migrations (TODO: adopt)
│       │   ├── Cargo.toml
│       │   ├── tauri.conf.json
│       │   └── capabilities/
│       │       └── default.json
│
├── packages/
│   ├── agent-types/                     # SINGLE SOURCE OF TRUTH for TS types
│   │   ├── src/
│   │   │   └── index.ts                # All shared interfaces
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── agent-registry/                  # Data-driven agent definitions
│   │   ├── src/
│   │   │   └── index.ts                # AgentRegistry (YAML loader)
│   │   ├── agents/
│   │   │   ├── software-engineer/
│   │   │   │   └── agent.yaml
│   │   │   └── cybersecurity/
│   │   │       └── agent.yaml
│   │   └── package.json
│   │
│   ├── ui/                              # Shared React components + theme
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── providers/
│   │   │   │   └── CyberpunkProvider.tsx
│   │   │   └── theme/
│   │   │       └── cyberpunk.ts
│   │   └── package.json
│   │
│   └── crypto/                          # Client-side encryption (Web Crypto API)
│       ├── src/
│       │   └── index.ts                # CryptoClient (reserved for future use)
│       └── package.json
│
├── tasks/                               # Development tracking
│   ├── todo.md                          # Current task plan
│   └── lessons.md                       # Learned patterns
├── AGENT.md                             # AI agent working guidelines
├── .gitignore
├── pnpm-workspace.yaml
├── package.json
├── turbo.json
├── tsconfig.base.json
└── README.md
```

## 4. Key Dependencies and Libraries

### Frontend (Next.js)

| Package | Actual Version | Purpose |
|---------|---------------|---------|
| `next` | `16.2.3` | React framework with App Router (breaking changes from v15!) |
| `react` | `19.2.4` | UI library |
| `typescript` | `^5.8.0` | Type safety |
| `tailwindcss` | `^4` | Utility-first CSS |
| `framer-motion` | `^12.23.24` | Animations for sci-fi effects |
| `@tanstack/react-query` | `^5.67.3` | Server state management |
| `zustand` | `^5.0.3` | Client state management |
| `@tauri-apps/api` | `^2.10.1` | Tauri IPC bridge |
| `lucide-react` | _planned_ | Icon set |
| `react-markdown` | _planned_ | Markdown rendering |

> **Note**: Next.js 16 has breaking changes from v15. Always read
> `node_modules/next/dist/docs/` before writing any code (per AGENTS.md).

### Backend (Rust)

| Crate | Purpose |
|-------|---------|
| `tauri@2` | Desktop app framework |
| `tokio` | Async runtime (reuse Tauri's, don't create a second one) |
| `sqlx@0.8` | SQLite async queries + migrations |
| `serde` | Serialization |
| `reqwest` | HTTP client for LLM APIs |
| `keyring@3.6` | OS keyring for secure credential storage |
| `aes-gcm@0.10` | AES-256-GCM encryption (for future encrypted data) |
| `thiserror@2` | Structured error types |
| `anyhow@1` | Ad-hoc error handling |
| `uuid@1.11` | Unique identifiers |
| `chrono@0.4` | Date/time handling |
| `futures-util@0.3` | Stream utilities for SSE parsing |

### Development Tools

| Tool | Purpose |
|------|---------|
| `pnpm@10.28.2` | Package manager with workspace support |
| `turbo@^2.4.4` | Build system for monorepo |
| `eslint@9` | Linting (eslint-config-next) |

## 5. Pluggable LLM Provider System Design

### Architecture

```rust
#[async_trait::async_trait]
pub trait LLMProvider: Send + Sync {
    fn name(&self) -> &'static str;
    fn provider_id(&self) -> ProviderId;

    async fn chat_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, LLMError>;

    async fn stream_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> Pin<Box<dyn Stream<Item = StreamEvent> + Send>>;
}
```

### Provider Factory

Providers are created on-demand via `ProviderFactory::create_provider(&config)`. The factory
maps `ProviderId` to concrete implementations. Unimplemented providers return a
`PlaceholderProvider` that yields a clear error.

```rust
pub struct ProviderFactory;

impl ProviderFactory {
    pub fn create_provider(config: &LLMConfig) -> Result<Box<dyn LLMProvider>, LLMError> {
        match config.provider_id {
            ProviderId::Anthropic => Ok(Box::new(AnthropicProvider::new(...))),
            ProviderId::OpenAI => Ok(Box::new(OpenAIProvider::new(...))),
            _ => Ok(Box::new(PlaceholderProvider::new(config.provider_id))),
        }
    }

    pub fn default_model(provider_id: ProviderId) -> &'static str { ... }
}
```

### Provider Implementations

- **Anthropic Claude** (`anthropic.rs`) - Implemented. Uses `/v1/messages` endpoint with Anthropic-specific SSE event types.
- **OpenAI GPT** (`openai.rs`) - Implemented. Uses `/chat/completions` endpoint with SSE streaming.
- **Google Gemini** - Planned. Will use Gemini API format.
- **DeepSeek** - Implemented via the OpenAI-compatible provider path.
- **Ollama** - Planned. Local inference via OpenAI-compatible endpoint.

### TypeScript Type System

All shared TypeScript types live in `@pantheon-forge/agent-types`. The frontend
imports types from there, NOT from local re-definitions.

```typescript
// packages/agent-types/src/index.ts (single source of truth)

export type ProviderId = 'anthropic' | 'openai' | 'google' | 'deepseek' | 'ollama';

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface Conversation {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ProviderCredential {
  provider_id: ProviderId;
  api_key: string;
  base_url?: string;
  model?: string;
  created_at: number;
}
```

> **Important**: `apps/desktop/lib/tauri.ts` should contain ONLY IPC invoke wrappers and
> the `isTauri()` check. All type definitions must come from `@pantheon-forge/agent-types`.

## 6. Data-Driven Agent System

### Design Philosophy

Agents are **configurations, not code**. An agent is fully defined by:
1. **YAML Configuration**: System prompt, capabilities, available tools, LLM preferences, collaboration rules
2. **No TypeScript/Rust classes needed**: The execution engine injects the system prompt and filters available tools based on the YAML definition

This avoids over-engineering. Adding a new agent is as simple as adding a YAML file.

### Agent Configuration Schema (YAML)

```yaml
# packages/agent-registry/agents/software-engineer/agent.yaml
id: software-engineer
name: Software Engineer
description: Expert software development assistant specializing in code generation, debugging, refactoring, and best practices.

system_prompt: |
  You are an expert Software Engineer with deep knowledge across multiple
  programming languages, frameworks, and paradigms.
  ...

capabilities:
  - id: code-generation
    name: Code Generation
    description: Generate code snippets, functions, and complete modules
  - id: debugging
    name: Debugging
    description: Analyze code issues and provide fixes
  ...

tools:
  - id: read-file
    name: Read File
    risk_level: low
  - id: write-file
    name: Write File
    risk_level: medium
  - id: execute-command
    name: Execute Command
    risk_level: high
  ...

llm_preference: anthropic

collaboration_rules:
  - type: can-consult
    target_agent_id: cybersecurity
    conditions: "When identifying potential security vulnerabilities"
  - type: can-handoff-to
    target_agent_id: cybersecurity
    conditions: "When task requires specialized security expertise"
```

### Agent Registry (TypeScript)

The `AgentRegistry` class in `packages/agent-registry` loads YAML files and exposes
lookup/collaboration queries. It operates purely on data - no class hierarchies.

```typescript
export class AgentRegistry {
  private agents: Map<string, Agent>;

  loadFromDirectory(agentsDir: string): void;
  getAgent(id: string): Agent | undefined;
  listAgents(): Agent[];
  getCollaborators(agentId: string): Agent[];
}
```

### Agent Execution (Rust Backend)

When a conversation uses an agent, the Rust backend:
1. Looks up the agent's YAML config (loaded via the TypeScript registry, or parsed directly in Rust)
2. Injects the agent's `system_prompt` as the first message
3. Filters the available tools to only those the agent has access to
4. Uses the agent's `llm_preference` to select the provider

No Rust `Agent` trait or TypeScript `BaseAgent` class is needed.

## 7. Multi-Agent Collaboration System (Architectural Vision)

> **Status**: This section describes the long-term vision. Detailed design and
> implementation will be deferred until Phases 1-4 are complete. The architecture
> below is speculative and will be refined when we approach this phase.

### Concept: Hub-and-Spoke with Delegation

```
┌─────────────────────────────────────────────────────────────────┐
│                    Collaboration Orchestrator                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Message Bus / Event System                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Agent A    │    │   Agent B    │    │   Agent C    │
│ (Coordinator)│◄───│ (Specialist) │◄───│ (Specialist) │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Collaboration Scenarios (Target)

1. **Security Handoff** - Software Engineer detects vulnerability, hands off to Cybersecurity Specialist with context
2. **Parallel Task Delegation** - Coordinator splits task, delegates sub-tasks, aggregates results
3. **Peer Consultation** - Agent A requests input from Agent B within same conversation

### Key Design Decisions (To Be Made)
- Message protocol format (Rust enum vs. JSON)
- Orchestrator: in-process or separate thread
- How collaboration rules from YAML are enforced
- UI representation of multi-agent conversations

## 8. Tool Execution Approval Workflow

### Architecture

```
┌─────────────┐    Request     ┌──────────────┐    Display UI    ┌──────────┐
│   Agent     │ ─────────────► │  Tool Broker │ ───────────────► │   User   │
└─────────────┘                └──────────────┘                 └──────────┘
                                     ▲                              │
                                     │                              │ Approval/
                                     │                         Denial
                                     │                              │
                           Execute   │                    Display UI ◄─┘
                        ┌────────────┴─────────────┐
                        │                          │
                   ┌────▼────┐              ┌──────▼─────┐
                   │ Execute │              │    Cancel  │
                   │  Tool   │              │   Task     │
                   └────┬────┘              └────────────┘
                        │
                   ┌────▼────┐
                   │  Result │
                   └────┬────┘
                        │
                        ▼
              ┌──────────────────┐
              │ Return to Agent │
              └──────────────────┘
```

### Implementation

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ToolRequest {
    pub id: Uuid,
    pub agent_id: String,
    pub tool_name: String,
    pub parameters: serde_json::Value,
    pub risk_level: RiskLevel,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq)]
pub enum RiskLevel {
    Low,      // Inspection operations
    Medium,   // Non-destructive writes
    High,     // File deletions, system changes
    Critical, // Network requests, external API calls
}

#[derive(Debug, Serialize, Deserialize)]
pub enum ToolApproval {
    Approved,
    Denied { reason: String },
    ApprovedWithModifications { modified_parameters: serde_json::Value },
}
```

### Tool Definitions

```rust
#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn risk_level(&self) -> RiskLevel;
    fn required_parameters() -> Vec<Parameter>;

    async fn execute(&self, parameters: serde_json::Value) -> Result<ToolResult, ToolError>;
    fn validate_parameters(&self, parameters: &serde_json::Value) -> Result<(), ToolError>;
}
```

### Frontend Approval Dialog

The approval dialog will be implemented in `apps/desktop/components/approval/ApprovalDialog.tsx`.
It displays risk level (color-coded), agent info, tool name, parameters (JSON), and
Approve/Deny actions.

## 9. Storage Layer Design

### Credential Storage: OS Keyring

API keys and provider credentials are stored in the **operating system keyring**
(macOS Keychain, Windows Credential Manager, Linux Secret Service) via the `keyring` crate.
This is superior to SQLCipher for credential storage because:

- **Zero-code encryption**: The OS handles encryption and access control
- **Cross-platform**: Works on all platforms without additional native dependencies
- **User trust**: Users can audit/remove credentials via OS settings
- **No key management**: No need to derive/manage encryption keys

```rust
// credentials/mod.rs - CredentialManager uses OS keyring
pub struct CredentialManager { service_name: String }

impl CredentialManager {
    pub fn store_provider(&self, credential: ProviderCredential) -> Result<()>;
    pub fn get_provider(&self, provider_id: ProviderId) -> Result<ProviderCredential>;
    pub fn remove_provider(&self, provider_id: ProviderId) -> Result<()>;
    pub fn list_providers(&self) -> Result<Vec<ProviderId>>;
    pub fn clear_all(&self) -> Result<()>;
}
```

### SQLite Storage: Conversations, Messages, Settings

SQLite (plain, not SQLCipher) stores non-sensitive data. The database lives in the
proper Tauri app data directory.

```sql
-- Conversations
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Messages
CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    tool_calls TEXT,
    tool_call_id TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Settings
CREATE TABLE settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Tool execution log (added in Phase 4)
CREATE TABLE tool_executions (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    agent_id TEXT,
    tool_name TEXT,
    parameters TEXT,
    result TEXT,
    approved INTEGER,
    executed_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
);

-- Collaboration events (added in Phase 5)
CREATE TABLE collaboration_events (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    from_agent TEXT,
    to_agent TEXT,
    message_type TEXT NOT NULL,
    content TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_conversations_agent ON conversations(agent_id);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX idx_tool_executions_conversation ON tool_executions(conversation_id);
```

### Database Path

The database must be stored in the Tauri app data directory, NOT `current_dir()`:

```rust
// CORRECT - use Tauri's app data directory
fn get_db_path(app: &tauri::App) -> PathBuf {
    app.path().app_data_dir()
        .expect("Failed to resolve app data dir")
        .join("pantheon-forge.db")
}
```

### Migration Strategy

Use `sqlx` migrations instead of inline `CREATE TABLE IF NOT EXISTS`:

```
src-tauri/migrations/
├── 20250101000001_init.sql          # conversations, messages, settings
├── 20250101000002_indexes.sql       # initial indexes
├── 20250201000001_tool_executions.sql  # added in Phase 3
└── 20250301000001_collaboration.sql    # added in Phase 5
```

```rust
// In StorageManager::new()
sqlx::migrate!("./migrations").run(&pool).await?;
```

### Encryption Utilities

`crypto/mod.rs` provides AES-256-GCM encryption/decryption functions. These are reserved
for encrypting sensitive conversation data or settings in the future. Currently not used
by any module. The `packages/crypto` TypeScript package (Web Crypto API) is similarly
reserved. Neither should be removed - they'll be needed when we add optional
conversation encryption.

## 10. Error Handling Strategy

### Rust Backend

All modules define structured error types using `thiserror`:

```rust
#[derive(Debug, thiserror::Error)]
pub enum LLMError {
    #[error("Missing API key for provider: {0}")]
    MissingApiKey(String),
    #[error("HTTP request failed: {0}")]
    RequestError(#[from] reqwest::Error),
    // ...
}

#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),
    // ...
}

#[derive(Debug, thiserror::Error)]
pub enum CredentialError {
    #[error("Keyring error: {0}")]
    KeyringError(#[from] keyring::Error),
    // ...
}
```

### IPC Error Contract

IPC commands currently flatten errors to `String` via `.map_err(|e| e.to_string())`.
This should be improved to a structured error type that the frontend can parse:

```rust
// Future improvement: structured IPC errors
#[derive(Debug, Serialize)]
pub struct IpcError {
    pub kind: String,   // "llm", "storage", "credential", "validation"
    pub message: String,
}
```

## 11. IPC Module Organization

The Rust backend should split IPC handlers into separate modules to avoid `lib.rs` growing
unbounded:

```
src-tauri/src/
├── lib.rs              # App setup, module registration
├── main.rs             # Entry point
├── ipc/                # IPC command handlers
│   ├── mod.rs          # Re-exports all commands
│   ├── llm.rs          # chat_completion, stream_chat_completion
│   ├── credentials.rs  # credential CRUD commands
│   ├── conversations.rs # conversation CRUD commands
│   └── settings.rs     # settings CRUD commands
├── llm/
├── credentials/
├── storage/
└── crypto/
```

`lib.rs` registers all commands from the `ipc` module:

```rust
mod ipc;

tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        ipc::llm::chat_completion,
        ipc::llm::stream_chat_completion,
        ipc::credentials::store_provider_credentials,
        // ...
    ])
```

## 12. Runtime Configuration

### Tokio Runtime

Do NOT create a separate tokio runtime in Tauri's `setup()`. Tauri already has an
async runtime. Use `tauri::async_runtime::block_on()` or restructure initialization:

```rust
// WRONG - creates a second runtime
tokio::runtime::Runtime::new().unwrap().block_on(StorageManager::new(db_path))

// CORRECT - use Tauri's runtime
tauri::async_runtime::block_on(StorageManager::new(db_path))
```

## 13. Sci-Fi/Cyberpunk UI Theme Design

### Color Palette

```typescript
// packages/ui/src/theme/cyberpunk.ts

export const cyberpunkTheme = {
  colors: {
    primary: {
      DEFAULT: '#00f0ff',
      dark: '#00a8b3',
      light: '#4dffff',
    },
    secondary: {
      DEFAULT: '#ff00ff',
      dark: '#b300b3',
      light: '#ff4dff',
    },
    accent: {
      DEFAULT: '#39ff14',
      dark: '#2db80f',
      light: '#7cff66',
    },
    background: {
      primary: '#0a0a0f',
      secondary: '#12121a',
      tertiary: '#1a1a25',
    },
    border: {
      DEFAULT: '#1a1a2e',
      glow: '#00f0ff',
      alert: '#ff0044',
    },
    text: {
      primary: '#e0e0e0',
      secondary: '#a0a0a0',
      muted: '#606060',
    },
  },
  effects: {
    glow: '0 0 20px rgba(0, 240, 255, 0.3)',
    glowStrong: '0 0 30px rgba(0, 240, 255, 0.5)',
    scanline: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.1) 2px, rgba(0, 0, 0, 0.1) 4px)',
  },
  animations: {
    pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    glitch: 'glitch 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both infinite',
    scan: 'scan 8s linear infinite',
  },
};
```

### Key CSS Effects

```css
.cyberpunk-card {
  background: linear-gradient(135deg, rgba(18, 18, 26, 0.9), rgba(26, 26, 37, 0.9));
  border: 1px solid rgba(0, 240, 255, 0.2);
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.cyberpunk-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #00f0ff, transparent);
}

.cyberpunk-button {
  background: linear-gradient(135deg, #00a8b3, #00f0ff);
  border: none;
  color: #000;
  text-transform: uppercase;
  letter-spacing: 2px;
  font-weight: bold;
}
```

## 14. Implementation Phases

### Phase 1: Foundation & Cleanup (Weeks 1-2) — COMPLETE

**Goal**: Solid foundation with correct architecture

- [x] Set up monorepo with pnpm workspaces
- [x] Initialize Tauri + Next.js project
- [x] Set up TypeScript configuration
- [x] Implement base cyberpunk theme
- [x] Create basic chat UI (message list, input)
- [x] Set up SQLite database
- [x] Implement basic storage layer
- [x] Implement Anthropic + OpenAI providers with streaming
- [x] Implement credential storage via OS keyring
- [x] Build settings UI for provider configuration
- [x] Implement chat completion with streaming
- [x] **Fix**: Consolidate types into `@pantheon-forge/agent-types` (remove duplicates from `lib/tauri.ts`)
- [x] **Fix**: DB path should use Tauri app data dir (not `current_dir()`)
- [x] **Fix**: Use `tauri::async_runtime::block_on()` instead of creating separate tokio runtime
- [x] **Fix**: Adopt `sqlx::migrate!()` instead of inline schema creation
- [x] **Fix**: Split `lib.rs` IPC handlers into `ipc/` modules

### Phase 2: Agent System (Weeks 3-4) — COMPLETE

**Goal**: Data-driven agent system with YAML configs

- [x] Implement YAML agent configuration parser (`agent-registry` package)
- [x] Create Software Engineer agent YAML
- [x] Create Cybersecurity Specialist agent YAML
- [x] Pre-compile agent data as browser-safe static exports
- [x] Wire agent selection into chat flow (inject system prompt from YAML)
- [x] Build agent selection/switching UI (home page → chat with `?agent=id`)
- [x] Connect agent's `llm_preference` to provider selection
- [x] Filter available tools per-agent based on YAML `tools` list
- [x] Add agent metadata to conversation persistence (agent_id stored correctly)
- [x] Display active agent name in chat header and message labels
- [x] Show agent badge in ConversationList items

### Phase 3: Tool System (Weeks 5-6) — COMPLETE

**Goal**: Safe tool execution with approval

- [x] Design tool trait and registry (Rust)
- [x] Implement built-in tools (`read-file`, `search-files`, `write-file`, `execute-command`)
- [x] Build approval workflow system (emit event → wait for user response)
- [x] Add approval UI attached to the chat composer
- [x] Implement tool execution logging (write to `tool_executions` table)
- [x] Add static risk assessment for tool calls
- [x] Add richer approval previews for writes and commands
- [x] Create tool management UI in Settings
- [x] Scope tool availability to a conversation-bound project grant
- [x] Persist recent execution history across conversations

### Phase 4: Additional Providers (Weeks 7-8) — NEXT

**Goal**: Expand LLM provider coverage

- [ ] Implement Ollama provider (local inference)
- [ ] Implement Google Gemini provider
- [ ] Add provider-specific streaming tests
- [ ] Improve structured IPC error responses

### Phase 4A: Specialist Tool Expansion

**Goal**: Expand beyond the core file/command tool set

- [ ] Implement `analyze-dependencies`
- [ ] Implement `scan-network`

### Phase 5: Polish & Core Features (Weeks 9-10)

**Goal**: Production-quality core experience

- [ ] Add conversation search
- [ ] Add export/import functionality
- [ ] Create onboarding experience
- [ ] Add keyboard shortcuts
- [ ] Performance optimization (virtual scrolling, lazy loading)
- [ ] Comprehensive error handling in UI

### Phase 6: Multi-Agent Collaboration (Weeks 11-12)

**Goal**: Agents working together (design and implement based on Phase 5 learnings)

- [ ] Design and finalize message protocol
- [ ] Implement collaboration orchestrator
- [ ] Create agent delegation system
- [ ] Build handoff mechanism
- [ ] Add collaboration UI (show agent interactions)
- [ ] Implement conversation state transfer
- [ ] Create collaboration event logging

### Phase 7: Testing & Release (Weeks 13-14)

**Goal**: Production-ready application

- [ ] Write comprehensive tests (Rust unit + integration, TypeScript component tests)
- [ ] Security audit
- [ ] Create documentation
- [ ] Build release binaries (macOS, Windows, Linux)
- [ ] Set up auto-update mechanism
- [ ] Create user guide

## 15. Critical Files

### Frontend

| File | Purpose |
|------|---------|
| `apps/desktop/app/layout.tsx` | Root layout with fonts, TauriGuard, metadata |
| `apps/desktop/app/page.tsx` | Home page with agent sidebar |
| `apps/desktop/app/chat/page.tsx` | Chat page with ConversationList + ChatInterface |
| `apps/desktop/components/chat/ChatInterface.tsx` | Main chat UI with message list |
| `apps/desktop/components/chat/ChatInput.tsx` | Input textarea with send |
| `apps/desktop/lib/tauri.ts` | Tauri IPC invoke wrappers (types from agent-types) |
| `apps/desktop/lib/streaming.ts` | Stream event listener via Tauri events |
| `apps/desktop/stores/chat.ts` | Chat state: messages, streaming, send logic |
| `apps/desktop/stores/settings.ts` | Provider credentials and app settings |
| `apps/desktop/app/globals.css` | Cyberpunk CSS theme (490 lines) |

### Backend (Rust)

| File | Purpose |
|------|---------|
| `src-tauri/src/lib.rs` | App setup, IPC handler registration |
| `src-tauri/src/llm/types.rs` | All LLM type definitions (ProviderId, Message, etc.) |
| `src-tauri/src/llm/registry.rs` | LLMProvider trait + ProviderFactory |
| `src-tauri/src/llm/anthropic.rs` | Anthropic Claude provider |
| `src-tauri/src/llm/openai.rs` | OpenAI GPT provider |
| `src-tauri/src/credentials/mod.rs` | OS keyring credential storage |
| `src-tauri/src/storage/mod.rs` | SQLite storage for conversations/messages/settings |
| `src-tauri/src/crypto/mod.rs` | AES-256-GCM encryption utilities (reserved) |

### Shared

| File | Purpose |
|------|---------|
| `packages/agent-types/src/index.ts` | **Single source of truth** for all TS types |
| `packages/agent-registry/src/index.ts` | AgentRegistry: YAML loader + lookup |
| `packages/agent-registry/agents/*/agent.yaml` | Agent definitions (system prompts, tools, rules) |
| `packages/ui/src/theme/cyberpunk.ts` | Complete cyberpunk theme config |
| `packages/ui/src/providers/CyberpunkProvider.tsx` | Theme context provider |

## 16. Security Considerations

### Data Protection
1. **Credential Storage**: OS keyring (Keychain/Credential Manager/Secret Service)
2. **Database**: Plain SQLite for non-sensitive data (conversations, settings)
3. **Encryption**: AES-256-GCM available for future encrypted conversation storage
4. **Memory Safety**: Rust backend prevents memory-related vulnerabilities

### Execution Safety
1. **Manual Approval**: All tool executions require user consent
2. **Risk Assessment**: Tools categorized by risk level (Low/Medium/High/Critical)
3. **Parameter Validation**: All tool inputs validated before execution
4. **Audit Logging**: All executions logged to `tool_executions` table

### Network Security
1. **Local-First**: All data stored locally
2. **No Telemetry**: Optional only, opt-in
3. **TLS Only**: All external API calls use HTTPS
4. **Certificate Pinning**: Verify LLM provider certificates (future)

## 17. Performance Considerations

1. **Streaming Responses**: Implemented for all LLM calls via SSE
2. **Lazy Loading**: Load conversations and messages on demand
3. **Database Indexing**: Indexes on `conversation_id`, `agent_id`, `updated_at`
4. **Connection Pooling**: SQLite pool with max 5 connections
5. **Caching**: Cache agent configurations and provider info
6. **Virtual Scrolling**: For long conversation histories (Phase 5)

## 18. Future Extensibility

### Planned Features
1. **Local LLM Support**: Ollama integration (Phase 4)
2. **Custom Agents**: User-defined agent creation UI
3. **Agent Marketplace**: Community agent sharing
4. **Plugin System**: Third-party tool development
5. **Voice Interface**: Speech-to-text and text-to-speech
6. **Encrypted Conversations**: Optional AES-256-GCM conversation encryption
7. **API Server**: REST API for external integrations

### Extension Points
- **Custom LLM Providers**: Implement `LLMProvider` trait in Rust
- **Custom Tools**: Implement `Tool` trait in Rust
- **Custom Agents**: Add a YAML file to `agent-registry/agents/`
- **Custom Themes**: Pluggable theme system via `@pantheon-forge/ui`

## Conclusion

Pantheon Forge is designed as a secure, local-first AI agent platform with a compelling sci-fi aesthetic. The architecture prioritizes:

1. **Security**: Through Rust backend, OS keyring, and approval workflows
2. **Simplicity**: Data-driven agents (YAML configs, not class hierarchies), single source of truth for types
3. **User Control**: Manual approval for all tool actions
4. **Performance**: Streaming, caching, and efficient data structures
5. **Developer Experience**: Type safety across Rust and TypeScript, proper migrations, modular IPC
6. **Correctness**: Proper app data directories, single async runtime, structured errors

The modular architecture allows for incremental development and easy extension while maintaining a cohesive user experience.
