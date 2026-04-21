# Tasks

Internal roadmap snapshot for ongoing development. Public project status lives in the root README.

## Stabilization Pass — COMPLETE

- [x] Normalize stored message roles and repair legacy quoted values via migration
- [x] Remove build-time Google Font dependency for offline/restricted builds
- [x] Fix chat composer provider resolution without effect-driven derived state
- [x] Mark planned providers in shared metadata and reflect that state in Settings/chat UI
- [x] Clean repo hygiene issues (`package-lock.json`, generated lint targets, ignore rules)
- [x] Align top-level docs with the actual stack and current implementation status

## Phase 2: Agent System — COMPLETE

- [x] Pre-compile agent YAML → browser-safe static exports (`agents-data.ts` + `browser.ts` entry)
- [x] Create agent store (Zustand) with current agent + registry data (`stores/agents.ts`)
- [x] Pass agent context via `?agent=id` URL param from home → chat page
- [x] Inject agent system prompt into LLM messages
- [x] Use agent `llm_preference` for provider selection
- [x] Display active agent in chat UI (header bar, message labels)
- [x] Show agent badge in ConversationList items
- [x] Fix Suspense boundary for `useSearchParams` in Next.js 16

## Phase 3: Tool System — COMPLETE

- [x] Design tool trait and registry (Rust)
- [x] Implement built-in tools (read, write, execute, search)
- [x] Build approval workflow system (emit event → wait for user response)
- [x] Create approval UI for tool requests
- [x] Implement tool execution logging (write to `tool_executions` table)
- [x] Add risk assessment for tool calls
- [x] Add approval previews for writes and commands
- [x] Create tool management UI

## Phase 4: Provider Expansion — COMPLETE

- [x] Implement Ollama provider
- [x] Implement Google Gemini provider
- [x] Add provider-specific streaming tests
- [x] Improve structured IPC error responses

## Next: Specialist Tools

- [ ] Implement `analyze-dependencies` for Cybersecurity Specialist
- [ ] Implement `scan-network` for Cybersecurity Specialist
