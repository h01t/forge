'use client';

export default function StreamingIndicator({ agentName }: { agentName?: string }) {
  return (
    <div className="flex justify-start mb-4">
      <div className="message-assistant max-w-[75%]">
        <div className="msg-bubble px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-display font-semibold tracking-wider text-primary-500">
              {(agentName ?? 'ASSISTANT').toUpperCase()}
            </span>
            <div className="loading-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
