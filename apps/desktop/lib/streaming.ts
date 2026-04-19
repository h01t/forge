import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { AgentTurnStreamPayload } from '@/lib/tauri';

export type { UnlistenFn };

export interface StreamPayload {
  request_id: string;
  event_type: 'start' | 'content' | 'done' | 'error';
  delta?: string;
  finish_reason?: string;
  error?: string;
}

export interface StreamCallbacks {
  onStart?: () => void;
  onContent?: (delta: string) => void;
  onDone?: (finishReason?: string) => void;
  onError?: (message: string) => void;
}

export interface AgentTurnCallbacks {
  onStart?: () => void;
  onContent?: (delta: string) => void;
  onApprovalRequested?: (payload: AgentTurnStreamPayload) => void;
  onApprovalResolved?: (payload: AgentTurnStreamPayload) => void;
  onToolRunning?: (payload: AgentTurnStreamPayload) => void;
  onToolFinished?: (payload: AgentTurnStreamPayload) => void;
  onDone?: (finishReason?: string) => void;
  onError?: (message: string) => void;
}

export function listenStream(
  requestId: string,
  callbacks: StreamCallbacks,
): Promise<UnlistenFn> {
  return listen<StreamPayload>('stream-event', (event) => {
    if (event.payload.request_id !== requestId) return;

    switch (event.payload.event_type) {
      case 'start':
        callbacks.onStart?.();
        break;
      case 'content':
        if (event.payload.delta) {
          callbacks.onContent?.(event.payload.delta);
        }
        break;
      case 'done':
        callbacks.onDone?.(event.payload.finish_reason ?? undefined);
        break;
      case 'error':
        callbacks.onError?.(event.payload.error ?? 'Unknown stream error');
        break;
    }
  });
}

export function listenAgentTurn(
  requestId: string,
  callbacks: AgentTurnCallbacks,
): Promise<UnlistenFn> {
  return listen<AgentTurnStreamPayload>('agent-turn-event', (event) => {
    if (event.payload.request_id !== requestId) return;

    switch (event.payload.event_type) {
      case 'start':
        callbacks.onStart?.();
        break;
      case 'content':
        if (event.payload.delta) {
          callbacks.onContent?.(event.payload.delta);
        }
        break;
      case 'approval_requested':
        callbacks.onApprovalRequested?.(event.payload);
        break;
      case 'approval_resolved':
        callbacks.onApprovalResolved?.(event.payload);
        break;
      case 'tool_running':
        callbacks.onToolRunning?.(event.payload);
        break;
      case 'tool_finished':
        callbacks.onToolFinished?.(event.payload);
        break;
      case 'done':
        callbacks.onDone?.(event.payload.finish_reason ?? undefined);
        break;
      case 'error':
        callbacks.onError?.(event.payload.error ?? 'Unknown turn error');
        break;
    }
  });
}

export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
