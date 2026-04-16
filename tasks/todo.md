# Tasks

## Phase 1 Cleanup — COMPLETE

- [x] Consolidate types into `@pantheon-forge/agent-types`, remove duplicates from `lib/tauri.ts`
- [x] Fix DB path to use Tauri app data dir
- [x] Use `tauri::async_runtime::block_on()` instead of separate tokio runtime
- [x] Adopt `sqlx::migrate!()` for schema management
- [x] Split `lib.rs` IPC handlers into `ipc/` modules

## Phase 2: Agent System — NEXT

- [ ] Wire agent selection into chat flow (inject system prompt from YAML)
- [ ] Build agent selection/switching UI
- [ ] Connect agent's `llm_preference` to provider selection
- [ ] Filter available tools per-agent based on YAML `tools` list
- [ ] Add agent metadata to conversation persistence
