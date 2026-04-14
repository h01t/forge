import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';

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

export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
