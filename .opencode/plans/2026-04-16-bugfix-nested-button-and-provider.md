# Bugfix Plan: Two Phase 2 Bugs

## Bug 1: Nested `<button>` in ConversationList

**File**: `apps/desktop/components/chat/ConversationList.tsx`
**Root cause**: Line 52 uses `<button>` for the conversation item, line 72 uses `<button>` for delete. HTML forbids nested buttons.
**Fix**: Change the outer `<button>` (line 52) to a `<div role="button" tabIndex={0}>` with `cursor-pointer` class. Add `onKeyDown` for Enter key support. Keep the inner delete as a `<button>`.

Replace lines 52-85 (the outer `<button>...</button>`) with:
```tsx
<div
  key={conv.id}
  role="button"
  tabIndex={0}
  onClick={() => onSelect(conv.id)}
  onKeyDown={(e) => { if (e.key === 'Enter') onSelect(conv.id); }}
  className={`w-full p-3 rounded-lg text-left transition-all duration-200 group cursor-pointer ${
    activeId === conv.id
      ? 'bg-surface-elevated border border-primary-500/40'
      : 'hover:bg-surface-hover border border-transparent'
  }`}
>
  {/* ... inner content stays the same (flex container, title, badge, delete button, date) ... */}
</div>
```

## Bug 2: "Provider not implemented" — Agent preference used without credential check

**Files**: `apps/desktop/components/chat/ChatInput.tsx`, `apps/desktop/stores/chat.ts`
**Root cause**: When an agent has `llmPreference: 'anthropic'`, the code blindly uses `'anthropic'` as the provider — even if the user hasn't configured Anthropic credentials. This sends a request to the Rust backend which can't find credentials, and for some providers falls through to `PlaceholderProvider`.

**Fix in `ChatInput.tsx`** (lines 16-20): Only use agent preference if credentials are actually configured:

```typescript
// Current (broken):
const resolvedProvider = currentAgent?.llmPreference
  ? (currentAgent.llmPreference as typeof activeProvider)
  : activeProvider;

// Fixed: only use agent preference if that provider has credentials
const agentPref = currentAgent?.llmPreference as ProviderId | undefined;
const resolvedProvider = (agentPref && providers[agentPref]?.credential)
  ? agentPref
  : activeProvider;
```

**Fix in `chat.ts`** (lines 113-115): Same logic — don't override provider if agent's preference isn't configured:

```typescript
// Current (broken):
const effectiveProvider = currentAgent?.llmPreference
  ? (currentAgent.llmPreference as ProviderId)
  : providerId;

// Fixed: trust the providerId passed from ChatInput (which already resolved correctly)
const effectiveProvider = providerId;
```

The chat store should just use whatever provider ChatInput sends it. ChatInput is already doing the correct resolution with the credential check. No need to duplicate the logic in the store.

## Verification
- `npx tsc --noEmit -p apps/desktop/tsconfig.json` should pass
- `pnpm build` in apps/desktop should pass
- No nested button warnings in browser console
- Sending a message should use the configured provider, not a placeholder
