# Tasks

## Phase 1 Cleanup (Current)

- [ ] Consolidate types into `@pantheon-forge/agent-types`, remove duplicates from `lib/tauri.ts`
- [ ] Fix DB path to use Tauri app data dir
- [ ] Use `tauri::async_runtime::block_on()` instead of separate tokio runtime
- [ ] Adopt `sqlx::migrate!()` for schema management
- [ ] Split `lib.rs` IPC handlers into `ipc/` modules
