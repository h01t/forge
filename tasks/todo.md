# Tasks

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

## Phase 3: Tool System — NEXT

- [ ] Design tool trait and registry (Rust)
- [ ] Implement built-in tools (read, write, execute, search)
- [ ] Build approval workflow system (emit event → wait for user response)
- [ ] Create approval dialog UI component
- [ ] Implement tool execution logging (write to `tool_executions` table)
- [ ] Add risk assessment for tool calls
- [ ] Create tool management UI
