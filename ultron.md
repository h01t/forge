# Pantheon Forge - AI Agent Platform Architecture Plan

   ## Executive Summary

   Pantheon Forge is a local-first AI agent platform featuring a sci-fi/cyberpunk aesthetic, built with Next.js, TypeScript, and delivered as a desktop
   application. The platform enables users to summon specialized AI agents that can collaborate with each other while maintaining full control through a manual
   approval workflow for all tool executions.

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
   │  │  │                    SQLite Storage Layer                       │  │ │
   │  │  │  (Conversations, Settings, Credentials - Encrypted)          │  │ │
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
   - **Agent Core**: Agent registry, execution engine, collaboration orchestrator
   - **LLM Gateway**: Provider abstraction layer, credential management
   - **Tool Broker**: Tool execution with approval workflow
   - **Storage Layer**: SQLite with encryption for sensitive data

  ## 3. Directory Structure

   ### Recommended: Monorepo with pnpm Workspaces

   ```
   pantheon-forge/
   ├── apps/
   │   ├── desktop/                    # Tauri app
   │   │   ├── src-tauri/              # Rust backend
   │   │   │   ├── src/
   │   │   │   │   ├── agents/         # Agent system
   │   │   │   │   ├── llm/            # LLM gateway
   │   │   │   │   ├── tools/          # Tool broker
   │   │   │   │   ├── storage/        # SQLite layer
   │   │   │   │   ├── ipc/            # IPC handlers
   │   │   │   │   └── main.rs
   │   │   │   ├── Cargo.toml
   │   │   │   └── tauri.conf.json
   │   │   ├── src/                    # Next.js frontend
   │   │   │   ├── app/                # App Router
   │   │   │   │   ├── chat/
   │   │   │   │   ├── tasks/
   │   │   │   │   ├── settings/
   │   │   │   │   └── layout.tsx
   │   │   │   ├── components/
   │   │   │   │   ├── chat/
   │   │   │   │   ├── agents/
   │   │   │   │   ├── ui/             # Base UI components
   │   │   │   │   └── theme/          # Cyberpunk theme
   │   │   │   ├── hooks/              # Custom React hooks
   │   │   │   ├── lib/                # Frontend utilities
   │   │   │   ├── stores/             # State management
   │   │   │   └── types/
   │   │   ├── public/
   │   │   ├── next.config.mjs
   │   │   ├── tailwind.config.ts
   │   │   ├── tsconfig.json
   │   │   └── package.json
   │   │
   ├── packages/
   │   ├── agent-types/                # Shared type definitions
   │   │   ├── src/
   │   │   │   ├── agent.ts
   │   │   │   ├── llm.ts
   │   │   │   ├── tool.ts
   │   │   │   └── collaboration.ts
   │   │   ├── package.json
   │   │   └── tsconfig.json
   │   │
   │   ├── agent-registry/             # Agent definitions
   │   │   ├── agents/
   │   │   │   ├── software-engineer/
   │   │   │   │   ├── agent.yaml
   │   │   │   │   ├── index.ts
   │   │   │   │   └── tools.ts
   │   │   │   ├── cybersecurity/
   │   │   │   │   ├── agent.yaml
   │   │   │   │   ├── index.ts
   │   │   │   │   └── tools.ts
   │   │   │   └── base/
   │   │   │       ├── base-agent.ts
   │   │   │       └── base-tools.ts
   │   │   └── package.json
   │   │
   │   ├── crypto/                     # Encryption utilities
   │   │   ├── src/
   │   │   │   ├── encryption.ts
   │   │   │   ├── key-manager.ts
   │   │   │   └── index.ts
   │   │   └── package.json
   │   │
   │   ├── ui/                         # Shared React components
   │   │   ├── src/
   │   │   │   ├── components/
   │   │   │   │   ├── button.tsx
   │   │   │   │   ├── card.tsx
   │   │   │   │   ├── input.tsx
   │   │   │   │   ├── dialog.tsx
   │   │   │   │   └── ...
   │   │   │   ├── theme/
   │   │   │   │   ├── colors.ts
   │   │   │   │   └── cyberpunk.ts
   │   │   │   └── index.ts
   │   │   └── package.json
   │   │
   ├── .gitignore
   ├── pnpm-workspace.yaml
   ├── package.json
   ├── turbo.json
   ├── tsconfig.base.json
   └── README.md
   ```

   ## 4. Key Dependencies and Libraries

   ### Frontend (Next.js)

   | Package | Purpose |
   |---------|---------|
   | `next@15` | React framework with App Router |
   | `react@19` | UI library |
   | `typescript@5` | Type safety |
   | `tailwindcss@4` | Utility-first CSS |
   | `framer-motion` | Animations for sci-fi effects |
   | `@tanstack/react-query` | Server state management |
   | `zustand` | Client state management |
   | `@tauri-apps/api` | Tauri IPC bridge |
   | `lucide-react` | Icon set |
   | `react-markdown` | Markdown rendering |

   ### Backend (Rust)

   | Crate | Purpose |
   |-------|---------|
   | `tauri` | Desktop app framework |
   | `tokio` | Async runtime |
   | `sqlx` | SQLite async ORM |
   | `sqlcipher` | SQLite encryption |
   | `serde` | Serialization |
   | `reqwest` | HTTP client for LLM APIs |
   | `surrealdb` | Alternative: Graph-like queries |
   | ` anyhow` | Error handling |
   | `tracing` | Structured logging |
   | `uuid` | Unique identifiers |

   ### Development Tools

   | Tool | Purpose |
   |------|---------|
   | `pnpm` | Package manager with workspace support |
   | `turbo` | Build system for monorepo |
   | `prettier` | Code formatting |
   | `eslint` | Linting |
   | `typescript-eslint` | TypeScript ESLint |

   ## 5. Pluggable LLM Provider System Design

   ### Architecture

   ```rust
   // Core Provider Trait
   #[async_trait]
   pub trait LLMProvider: Send + Sync {
       fn name(&self) -> &'static str;
       fn provider_id(&self) -> ProviderId;

       async fn chat_completion(
           &self,
           request: ChatCompletionRequest
       ) -> Result<ChatCompletionResponse, LLMError>;

       async fn stream_completion(
           &self,
           request: ChatCompletionRequest
       ) -> impl Stream<Item = Result<String, LLMError>>;

       fn validate_credentials(&self, credentials: &Credentials) -> Result<(), LLMError>;
   }

   // Registry Pattern
   pub struct LLMProviderRegistry {
       providers: HashMap<ProviderId, Box<dyn LLMProvider>>,
       credentials: EncryptedStore<Credentials>,
   }

   impl LLMProviderRegistry {
       pub fn register(&mut self, provider: Box<dyn LLMProvider>) {
           self.providers.insert(provider.provider_id(), provider);
       }

       pub async fn get_provider(
           &self,
           id: ProviderId
       ) -> Result<&dyn LLMProvider, LLMError> {
           self.providers.get(&id)
               .ok_or(LLMError::ProviderNotFound)
               .map(|p| p.as_ref())
       }

       pub fn list_providers(&self) -> Vec<ProviderInfo> {
           self.providers.values()
               .map(|p| ProviderInfo {
                   id: p.provider_id(),
                   name: p.name(),
                   configured: self.credentials.contains(p.provider_id()),
               })
               .collect()
       }
   }
   ```

   ### Provider Implementations

   **Anthropic Claude**
   ```rust
   pub struct AnthropicProvider {
       api_key: String,
       client: reqwest::Client,
       base_url: String,
   }

   #[async_trait]
   impl LLMProvider for AnthropicProvider {
       fn name(&self) -> &'static str { "Anthropic Claude" }
       fn provider_id(&self) -> ProviderId { ProviderId::Anthropic }

       async fn chat_completion(
           &self,
           request: ChatCompletionRequest
       ) -> Result<ChatCompletionResponse, LLMError> {
           // Implementation using Anthropic API
       }
   }
   ```

   **Similar implementations for:**
   - OpenAI GPT
   - Google Gemini
   - DeepSeek
   - Local Ollama (future addition)

   ### TypeScript Frontend Interface

   ```typescript
   // packages/agent-types/src/llm.ts

   export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'deepseek';

   export interface Message {
     role: 'user' | 'assistant' | 'system';
     content: string;
   }

   export interface ChatRequest {
     provider: ProviderId;
     model: string;
     messages: Message[];
     temperature?: number;
     maxTokens?: number;
     stream?: boolean;
   }

   export interface ProviderInfo {
     id: ProviderId;
     name: string;
     models: string[];
     configured: boolean;
   }
   ```

   ## 6. Hybrid Agent Definition System

   ### Design Philosophy

   Agents are defined through a combination of:
   1. **YAML Configuration**: Metadata, capabilities, system prompt
   2. **TypeScript Code**: Tool implementations, custom logic

   ### Agent Configuration Schema (YAML)

   ```yaml
   # packages/agent-registry/agents/software-engineer/agent.yaml
   id: software-engineer
   name: Software Engineer
   description: Expert in software development, debugging, and code architecture
   version: 1.0.0

   system_prompt: |
     You are an expert Software Engineer agent with deep knowledge in:
     - Modern web development (React, Next.js, TypeScript)
     - Backend development (Node.js, Python, Rust)
     - Database design and optimization
     - Testing and quality assurance
     - Code review and refactoring

     You collaborate with other agents when their expertise is needed.

     Always explain your reasoning before taking action. Wait for user approval
     before executing any tools or making changes.

   capabilities:
     - code_generation
     - code_review
     - debugging
     - architecture_design
     - testing

   tools:
     - read_file
     - write_file
     - execute_command
     - search_code
     - run_tests

   llm_preference:
     provider: anthropic
     model: claude-3-5-sonnet-20241022
     fallback:
       provider: openai
       model: gpt-4-turbo

   collaboration:
     can_delegate_to:
       - cybersecurity
     can_be_delegated_by: []
     handoff_triggers:
       - security_vulnerability
       - infrastructure_configuration
   ```

   ### Agent Implementation (TypeScript)

   ```typescript
   // packages/agent-registry/agents/software-engineer/index.ts
   import { BaseAgent } from '../../base/base-agent';
   import { SoftwareEngineerConfig } from './agent.yaml';
   import { codeReviewTool, generateCodeTool, debugTool } from './tools';

   export class SoftwareEngineerAgent extends BaseAgent {
     constructor() {
       super(SoftwareEngineerConfig);
     }

     protected registerTools(): void {
       this.registerTool(codeReviewTool);
       this.registerTool(generateCodeTool);
       this.registerTool(debugTool);
     }

     async handleDelegation(from: string, context: any): Promise<boolean> {
       // Custom delegation logic
       return true;
     }
   }
   ```

   ### Agent Registry

   ```typescript
   // src-tauri/src/agents/registry.rs

   pub struct AgentRegistry {
       agents: HashMap<AgentId, AgentDefinition>,
       instances: HashMap<AgentId, Box<dyn Agent>>,
   }

   impl AgentRegistry {
       pub fn load_from_config(&mut self, config_path: PathBuf) -> Result<()> {
           // Load YAML configs and instantiate agents
       }

       pub fn get_agent(&self, id: &AgentId) -> Option<&dyn Agent> {
           self.instances.get(id).map(|a| a.as_ref())
       }

       pub fn list_agents(&self) -> Vec<AgentInfo> {
           // Return agent metadata
       }
   }
   ```

   ## 7. Multi-Agent Collaboration System

   ### Architecture Pattern: Hub-and-Spoke with Delegation

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

   ### Message Protocol

   ```rust
   // Message types for inter-agent communication
   #[derive(Debug, Serialize, Deserialize)]
   pub enum AgentMessage {
       // Direct communication
       Direct {
           from: AgentId,
           to: AgentId,
           content: String,
           context: MessageContext,
       },

       // Broadcast to all agents
       Broadcast {
           from: AgentId,
           content: String,
           context: MessageContext,
       },

       // Request for delegation
       DelegationRequest {
           from: AgentId,
           to: AgentId,
           task: Task,
           reasoning: String,
       },

       // Response to delegation
       DelegationResponse {
           from: AgentId,
           to: AgentId,
           accepted: bool,
           result: Option<TaskResult>,
       },

       // Handoff for specialist work
       Handoff {
           from: AgentId,
           to: AgentId,
           conversation_state: ConversationState,
           reason: HandoffReason,
       },
   }

   #[derive(Debug, Serialize, Deserialize)]
   pub struct MessageContext {
       pub conversation_id: Uuid,
       pub parent_message_id: Option<Uuid>,
       pub timestamp: DateTime<Utc>,
       pub metadata: HashMap<String, String>,
   }

   #[derive(Debug, Serialize, Deserialize)]
   pub enum HandoffReason {
       SecurityConcern,
       SpecialistKnowledgeRequired,
       ToolAccessNeeded,
       ErrorEscalation,
   }
   ```

   ### Orchestrator Implementation

   ```rust
   pub struct CollaborationOrchestrator {
       agent_registry: Arc<RwLock<AgentRegistry>>,
       message_bus: MessageBus,
       active_conversations: HashMap<Uuid, Conversation>,
   }

   impl CollaborationOrchestrator {
       pub async fn route_message(&self, message: AgentMessage) -> Result<()> {
           match message {
               AgentMessage::Direct { from, to, content, context } => {
                   self.deliver_to_agent(to, message).await?;
               },
               AgentMessage::DelegationRequest { from, to, task, reasoning } => {
                   // Check if agent can accept delegation
                   if self.can_accept_delegation(to, &task).await? {
                       let response = self.delegate_task(from, to, task, reasoning).await?;
                       self.route_message(response).await?;
                   }
               },
               AgentMessage::Handoff { from, to, conversation_state, reason } => {
                   self.execute_handoff(from, to, conversation_state, reason).await?;
               },
               _ => {}
           }
           Ok(())
       }

       pub async fn execute_handoff(
           &self,
           from: AgentId,
           to: AgentId,
           state: ConversationState,
           reason: HandoffReason
       ) -> Result<()> {
           // 1. Inform user of handoff
           // 2. Transfer context
           // 3. Notify receiving agent
           // 4. Update conversation metadata
       }
   }
   ```

   ### Collaboration Scenarios

   1. **Security Handoff**
      - Software Engineer detects security vulnerability
      - Automatically triggers handoff to Cybersecurity Specialist
      - Context transferred with vulnerability details

   2. **Parallel Task Delegation**
      - Coordinator agent splits complex task
      - Delegates sub-tasks to specialist agents
      - Aggregates results

   3. **Peer Consultation**
      - Agent A requests input from Agent B
      - Both continue working on same conversation
      - User sees all agent interactions

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
       pub agent_id: AgentId,
       pub tool_name: String,
       pub parameters: serde_json::Value,
       pub risk_level: RiskLevel,
       pub description: String,
   }

   #[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq)]
   pub enum RiskLevel {
       Low,      // Read-only operations
       Medium,   // Non-destructive writes
       High,     // File deletions, system changes
       Critical, // Network requests, external API calls
   }

   #[derive(Debug, Serialize, Deserialize)]
   pub enum ToolApproval {
       Approved,
       Denied { reason: String },
       ApprovedWithModifications {
           modified_parameters: serde_json::Value
       },
   }

   pub struct ToolBroker {
       pending_approvals: Arc<RwLock<HashMap<Uuid, ToolRequest>>>,
       tool_registry: ToolRegistry,
   }

   impl ToolBroker {
       pub async fn request_tool_execution(
           &self,
           request: ToolRequest
       ) -> Result<ToolResult, ToolError> {
           // Store pending request
           self.pending_approvals.write()
               .await
               .insert(request.id, request.clone());

           // Notify frontend to show approval dialog
           self.emit_approval_event(&request).await?;

           // Wait for user response with timeout
           let approval = self.wait_for_approval(request.id).await?;

           match approval {
               ToolApproval::Approved => {
                   self.execute_tool(request).await
               },
               ToolApproval::Denied { reason } => {
                   Err(ToolError::Denied(reason))
               },
               ToolApproval::ApprovedWithModifications { modified_parameters } => {
                   let modified_request = ToolRequest {
                       parameters: modified_parameters,
                       ..request
                   };
                   self.execute_tool(modified_request).await
               }
           }
       }

       async fn execute_tool(&self, request: ToolRequest) -> Result<ToolResult, ToolError> {
           let tool = self.tool_registry.get_tool(&request.tool_name)?;
           let result = tool.execute(request.parameters).await?;

           // Log execution
           self.log_execution(&request, &result).await?;

           Ok(result)
       }
   }
   ```

   ### Frontend Approval Dialog

   ```typescript
   // apps/desktop/src/components/approval/ApprovalDialog.tsx

   interface ApprovalDialogProps {
     request: ToolRequest;
     onApprove: (modifications?: any) => void;
     onDeny: (reason: string) => void;
   }

   export function ApprovalDialog({ request, onApprove, onDeny }: ApprovalDialogProps) {
     const [modifications, setModifications] = useState<any>();
     const [denyReason, setDenyReason] = useState('');

     const getRiskColor = (level: RiskLevel) => {
       switch (level) {
         case 'Low': return 'text-green-400';
         case 'Medium': return 'text-yellow-400';
         case 'High': return 'text-orange-400';
         case 'Critical': return 'text-red-400 animate-pulse';
       }
     };

     return (
       <Dialog open>
         <DialogContent className="cyberpunk-dialog">
           <div className="space-y-4">
             {/* Risk indicator */}
             <div className="flex items-center gap-2">
               <AlertTriangle className={getRiskColor(request.riskLevel)} />
               <span className={`text-sm ${getRiskColor(request.riskLevel)}`}>
                 {request.riskLevel.toUpperCase()} RISK
               </span>
             </div>

             {/* Agent info */}
             <div>
               <h3 className="text-lg font-bold text-cyan-400">
                 {request.agent_id}
               </h3>
               <p className="text-sm text-gray-400">
                 requests to execute: <span className="text-white font-mono">
                   {request.tool_name}
                 </span>
               </p>
             </div>

             {/* Parameters */}
             <div className="bg-black/50 p-4 rounded border border-cyan-900">
               <pre className="text-xs text-green-400 font-mono overflow-auto">
                 {JSON.stringify(request.parameters, null, 2)}
               </pre>
             </div>

             {/* Actions */}
             <div className="flex gap-3 justify-end">
               <Button
                 variant="destructive"
                 onClick={() => onDeny(denyReason || 'User denied')}
               >
                 Deny
               </Button>
               <Button
                 className="bg-cyan-600 hover:bg-cyan-500"
                 onClick={() => onApprove(modifications)}
               >
                 Approve
               </Button>
             </div>
           </div>
         </DialogContent>
       </Dialog>
     );
   }
   ```

   ### Tool Definitions

   ```rust
   #[async_trait]
   pub trait Tool: Send + Sync {
       fn name(&self) -> &str;
       fn description(&self) -> &str;
       fn risk_level(&self) -> RiskLevel;
       fn required_parameters(&self) -> Vec<Parameter>;

       async fn execute(
           &self,
           parameters: serde_json::Value
       ) -> Result<ToolResult, ToolError>;

       fn validate_parameters(
           &self,
           parameters: &serde_json::Value
       ) -> Result<(), ToolError>;
   }

   // Built-in tools
   pub struct ReadFileTool;
   pub struct WriteFileTool;
   pub struct ExecuteCommandTool;
   pub struct WebSearchTool;
   pub struct ListDirectoryTool;
   ```

   ## 9. Storage Layer Design

   ### SQLite Schema

   ```sql
   -- Conversations
   CREATE TABLE conversations (
       id TEXT PRIMARY KEY,
       title TEXT NOT NULL,
       created_at INTEGER NOT NULL,
       updated_at INTEGER NOT NULL,
       agent_id TEXT NOT NULL,
       metadata TEXT
   );

   -- Messages
   CREATE TABLE messages (
       id TEXT PRIMARY KEY,
       conversation_id TEXT NOT NULL,
       role TEXT NOT NULL,
       content TEXT NOT NULL,
       created_at INTEGER NOT NULL,
       agent_id TEXT,
       tool_calls TEXT,
       FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
   );

   -- Agent configurations
   CREATE TABLE agents (
       id TEXT PRIMARY KEY,
       config TEXT NOT NULL,
       enabled INTEGER DEFAULT 1
   );

   -- LLM provider credentials (encrypted)
   CREATE TABLE provider_credentials (
       provider_id TEXT PRIMARY KEY,
       encrypted_credentials BLOB NOT NULL,
       created_at INTEGER NOT NULL,
       updated_at INTEGER NOT NULL
   );

   -- User settings
   CREATE TABLE settings (
       key TEXT PRIMARY KEY,
       value TEXT NOT NULL,
       encrypted INTEGER DEFAULT 0
   );

   -- Tool execution log
   CREATE TABLE tool_executions (
       id TEXT PRIMARY KEY,
       conversation_id TEXT,
       agent_id TEXT,
       tool_name TEXT,
       parameters TEXT,
       result TEXT,
       approved INTEGER,
       executed_at INTEGER NOT NULL,
       FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
   );

   -- Collaboration events
   CREATE TABLE collaboration_events (
       id TEXT PRIMARY KEY,
       conversation_id TEXT NOT NULL,
       from_agent TEXT,
       to_agent TEXT,
       message_type TEXT NOT NULL,
       content TEXT,
       created_at INTEGER NOT NULL,
       FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
   );

   CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
   CREATE INDEX idx_tool_executions_conversation ON tool_executions(conversation_id);
   ```

   ### Encryption Strategy

   ```rust
   use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
   use sqlx::SqlitePool;

   pub struct StorageManager {
       pool: SqlitePool,
       encryption_key: [u8; 32],
   }

   impl StorageManager {
       pub async fn new(db_path: &str, encryption_key: [u8; 32]) -> Result<Self> {
           // Use SQLCipher for database encryption
           let options = SqliteConnectOptions::new()
               .filename(db_path)
               .create_if_missing(true)
               .pragma("key", &hex::encode(encryption_key));

           let pool = SqlitePool::connect_with(options).await?;

           // Run migrations
           sqlx::migrate!("./migrations").run(&pool).await?;

           Ok(Self { pool, encryption_key })
       }

       pub async fn store_credentials(
           &self,
           provider_id: &str,
           credentials: &Credentials
       ) -> Result<()> {
           let encrypted = self.encrypt_credentials(credentials)?;

           sqlx::query(
               "INSERT INTO provider_credentials (provider_id, encrypted_credentials, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(provider_id) DO UPDATE SET
                    encrypted_credentials = ?2,
                    updated_at = ?4"
           )
           .bind(provider_id)
           .bind(&encrypted)
           .bind(Utc::now())
           .bind(Utc::now())
           .execute(&self.pool)
           .await?;

           Ok(())
       }

       fn encrypt_credentials(&self, credentials: &Credentials) -> Result<Vec<u8>> {
           // Use ChaCha20-Poly1305 for encryption
           let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng);
           let cipher = ChaCha20Poly1305::new(&self.encryption_key.into());

           let plaintext = serde_json::to_vec(credentials)?;
           let ciphertext = cipher.encrypt(&nonce, plaintext.as_ref())?;

           // Store nonce + ciphertext
           let mut result = nonce.to_vec();
           result.extend_from_slice(&ciphertext);
           Ok(result)
       }
   }
   ```

   ## 10. Sci-Fi/Cyberpunk UI Theme Design

   ### Color Palette

   ```typescript
   // packages/ui/src/theme/cyberpunk.ts

   export const cyberpunkTheme = {
     colors: {
       // Primary - Cyan/Electric Blue
       primary: {
         DEFAULT: '#00f0ff',
         dark: '#00a8b3',
         light: '#4dffff',
       },

       // Secondary - Magenta/Pink
       secondary: {
         DEFAULT: '#ff00ff',
         dark: '#b300b3',
         light: '#ff4dff',
       },

       // Accent - Neon Green
       accent: {
         DEFAULT: '#39ff14',
         dark: '#2db80f',
         light: '#7cff66',
       },

       // Backgrounds
       background: {
         primary: '#0a0a0f',
         secondary: '#12121a',
         tertiary: '#1a1a25',
       },

       // Borders
       border: {
         DEFAULT: '#1a1a2e',
         glow: '#00f0ff',
         alert: '#ff0044',
       },

       // Text
       text: {
         primary: '#e0e0e0',
         secondary: '#a0a0a0',
         muted: '#606060',
       },
     },

     // Effects
     effects: {
       glow: '0 0 20px rgba(0, 240, 255, 0.3)',
       glowStrong: '0 0 30px rgba(0, 240, 255, 0.5)',
       scanline: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.1) 2px, rgba(0, 0, 0, 0.1) 4px)',
     },

     // Animations
     animations: {
       pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
       glitch: 'glitch 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both infinite',
       scan: 'scan 8s linear infinite',
     },
   };
   ```

   ### Key Components

   #### Glitch Effect

   ```css
   @keyframes glitch {
     0% { transform: translate(0); }
     20% { transform: translate(-2px, 2px); }
     40% { transform: translate(-2px, -2px); }
     60% { transform: translate(2px, 2px); }
     80% { transform: translate(2px, -2px); }
     100% { transform: translate(0); }
   }

   @keyframes scan {
     0% { transform: translateY(-100%); }
     100% { transform: translateY(100%); }
   }

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
     top: 0;
     left: 0;
     right: 0;
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
     position: relative;
     overflow: hidden;
   }

   .cyberpunk-button::after {
     content: '';
     position: absolute;
     top: -50%;
     left: -50%;
     width: 200%;
     height: 200%;
     background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.3), transparent);
     transform: rotate(45deg);
     animation: shimmer 3s infinite;
   }
   ```

   #### Chat Interface

   ```typescript
   // apps/desktop/src/components/chat/ChatMessage.tsx

   export function ChatMessage({ message, agent }: ChatMessageProps) {
     const isAgent = message.role === 'assistant';

     return (
       <div className={cn(
         "flex gap-4 p-4 border-l-2",
         isAgent
           ? "border-cyan-500 bg-cyan-950/20"
           : "border-transparent bg-transparent"
       )}>
         <div className={cn(
           "w-10 h-10 rounded flex items-center justify-center font-bold",
           isAgent ? "bg-cyan-500/20 text-cyan-400" : "bg-purple-500/20 text-purple-400"
         )}>
           {isAgent ? agent?.avatar : 'U'}
         </div>

         <div className="flex-1 space-y-2">
           <div className="flex items-center gap-2">
             <span className={cn(
               "font-bold text-sm",
               isAgent ? "text-cyan-400" : "text-purple-400"
             )}>
               {isAgent ? agent?.name : 'User'}
             </span>
             <span className="text-xs text-gray-500">
               {formatTime(message.created_at)}
             </span>
           </div>

           <div className="text-gray-200 space-y-4">
             {message.content && (
               <div className="prose prose-invert prose-sm max-w-none">
                 <ReactMarkdown>{message.content}</ReactMarkdown>
               </div>
             )}

             {message.tool_calls && (
               <ToolCallList calls={message.tool_calls} />
             )}
           </div>
         </div>
       </div>
     );
   }
   ```

   ## 11. Implementation Phases

   ### Phase 1: Foundation (Weeks 1-2)
   **Goal**: Basic desktop app with chat interface

   - [ ] Set up monorepo with pnpm workspaces
   - [ ] Initialize Tauri + Next.js project
   - [ ] Set up TypeScript configuration
   - [ ] Implement base cyberpunk theme
   - [ ] Create basic chat UI (message list, input)
   - [ ] Set up SQLite database with migrations
   - [ ] Implement basic storage layer

   ### Phase 2: LLM Integration (Weeks 3-4)
   **Goal**: Connect to LLM providers

   - [ ] Design and implement LLM provider trait
   - [ ] Implement Anthropic Claude provider
   - [ ] Implement OpenAI GPT provider
   - [ ] Create credentials encryption system
   - [ ] Build settings UI for provider configuration
   - [ ] Implement chat completion with streaming
   - [ ] Add message history persistence

   ### Phase 3: Agent System (Weeks 5-6)
   **Goal**: Core agent functionality

   - [ ] Design agent registry and base agent class
   - [ ] Implement YAML agent configuration parser
   - [ ] Create Software Engineer agent
   - [ ] Create Cybersecurity Specialist agent
   - [ ] Build agent selection UI
   - [ ] Implement agent-to-LLM communication
   - [ ] Add agent metadata persistence

   ### Phase 4: Tool System (Weeks 7-8)
   **Goal**: Safe tool execution with approval

   - [ ] Design tool trait and registry
   - [ ] Implement built-in tools (read, write, execute, search)
   - [ ] Build approval workflow system
   - [ ] Create approval dialog UI
   - [ ] Implement tool execution logging
   - [ ] Add risk assessment for tool calls
   - [ ] Create tool management UI

   ### Phase 5: Multi-Agent Collaboration (Weeks 9-10)
   **Goal**: Agents working together

   - [ ] Design message protocol
   - [ ] Implement collaboration orchestrator
   - [ ] Create agent delegation system
   - [ ] Build handoff mechanism
   - [ ] Add collaboration UI (show agent interactions)
   - [ ] Implement conversation state transfer
   - [ ] Create collaboration event logging

   ### Phase 6: Additional Providers & Polish (Weeks 11-12)
   **Goal**: Complete feature set and polish

   - [ ] Implement Google Gemini provider
   - [ ] Implement DeepSeek provider
   - [ ] Add task runner dashboard
   - [ ] Implement conversation search
   - [ ] Add export/import functionality
   - [ ] Create onboarding experience
   - [ ] Add keyboard shortcuts
   - [ ] Performance optimization

   ### Phase 7: Testing & Release (Weeks 13-14)
   **Goal**: Production-ready application

   - [ ] Write comprehensive tests
   - [ ] Security audit
   - [ ] Create documentation
   - [ ] Build release binaries
   - [ ] Set up update mechanism
   - [ ] Create user guide

   ## 12. Critical Files for Implementation

   ### Frontend Critical Files

   1. **`/Users/grmim/Dev/ultron/apps/desktop/src/app/layout.tsx`**
      - Root layout with theme provider
      - Global styles and fonts
      - Tauri API initialization

   2. **`/Users/grmim/Dev/ultron/apps/desktop/src/components/chat/ChatInterface.tsx`**
      - Main chat UI component
      - Message list and input handling
      - Streaming response display
      - Agent status indicators

   3. **`/Users/grmim/Dev/ultron/packages/ui/src/theme/cyberpunk.ts`**
      - Complete theme definition
      - Color palette and effects
      - Animation definitions
      - Component styling utilities

   ### Backend Critical Files

   4. **`/Users/grmim/Dev/ultron/apps/desktop/src-tauri/src/llm/mod.rs`**
      - LLM provider trait definition
      - Provider registry implementation
      - All provider implementations (Claude, OpenAI, etc.)
      - Credential encryption management

   5. **`/Users/grmim/Dev/ultron/apps/desktop/src-tauri/src/agents/mod.rs`**
      - Agent registry and base agent trait
      - Agent configuration parsing
      - Agent execution engine
      - Collaboration orchestrator

   6. **`/Users/grmim/Dev/ultron/apps/desktop/src-tauri/src/tools/mod.rs`**
      - Tool trait and registry
      - Approval workflow implementation
      - Built-in tool implementations
      - Tool execution logging

   7. **`/Users/grmim/Dev/ultron/apps/desktop/src-tauri/src/storage/mod.rs`**
      - SQLite connection management
      - Encryption implementation
      - Schema migrations
      - Repository layer for all entities

   ### Shared Type Definitions

   8. **`/Users/grmim/Dev/ultron/packages/agent-types/src/index.ts`**
      - All shared TypeScript interfaces
      - Agent, LLM, Tool, Collaboration types
      - RPC message definitions

   9. **`/Users/grmim/Dev/ultron/packages/agent-registry/agents/software-engineer/agent.yaml`**
      - Template agent configuration
      - Defines agent capabilities and tools
      - Collaboration rules

   ## 13. Security Considerations

   ### Data Protection
   1. **Database Encryption**: SQLCipher for at-rest encryption
   2. **Credential Encryption**: ChaCha20-Poly1305 for API keys
   3. **Key Management**: Derive encryption key from user password/biometrics
   4. **Memory Safety**: Rust backend prevents memory-related vulnerabilities

   ### Execution Safety
   1. **Manual Approval**: All tool executions require user consent
   2. **Risk Assessment**: Tools categorized by risk level
   3. **Parameter Validation**: All tool inputs validated before execution
   4. **Audit Logging**: All executions logged with timestamps

   ### Network Security
   1. **Local-First**: All data stored locally
   2. **No Telemetry**: Optional only, opt-in
   3. **TLS Only**: All external API calls use HTTPS
   4. **Certificate Pinning**: Verify LLM provider certificates

   ## 14. Performance Considerations

   1. **Streaming Responses**: Implement streaming for all LLM calls
   2. **Lazy Loading**: Load conversations and messages on demand
   3. **Database Indexing**: Proper indexes on frequently queried columns
   4. **Connection Pooling**: Reuse SQLite connections
   5. **Caching**: Cache agent configurations and provider info
   6. **Virtual Scrolling**: For long conversation histories

   ## 15. Future Extensibility

   ### Planned Features
   1. **Local LLM Support**: Ollama, llama.cpp integration
   2. **Custom Agents**: User-defined agent creation UI
   3. **Agent Marketplace**: Community agent sharing
   4. **Plugin System**: Third-party tool development
   5. **Voice Interface**: Speech-to-text and text-to-speech
   6. **Collaboration Sessions**: Share conversations with other users
   7. **API Server**: REST API for external integrations

   ### Extension Points
   - **Custom LLM Providers**: Implement `LLMProvider` trait
   - **Custom Tools**: Implement `Tool` trait
   - **Custom Agents**: YAML + TypeScript combination
   - **Custom Themes**: Pluggable theme system

   ## Conclusion

   Pantheon Forge is designed as a secure, local-first AI agent platform with a compelling sci-fi aesthetic. The architecture prioritizes:

   1. **Security**: Through Rust backend, encryption, and approval workflows
   2. **Extensibility**: Through trait-based providers and hybrid agent definitions
   3. **User Control**: Manual approval for all actions
   4. **Performance**: Streaming, caching, and efficient data structures
   5. **Developer Experience**: Type safety across Rust and TypeScript

   The modular architecture allows for incremental development and easy extension while maintaining a cohesive user experience.
