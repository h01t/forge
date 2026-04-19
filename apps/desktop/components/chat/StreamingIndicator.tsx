'use client';

export default function StreamingIndicator({ agentName }: { agentName?: string }) {
  return (
    <div className="flex w-full justify-start">
      <div
        className="message-assistant min-w-0"
        style={{ maxWidth: 'min(92%, 110ch)' }}
      >
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="text-[10px] font-display font-semibold uppercase tracking-[0.17em] text-primary-400">
            {(agentName ?? 'Assistant').toUpperCase()}
          </span>
        </div>
        <div className="msg-bubble px-4.5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="loading-dots">
              <span />
              <span />
              <span />
            </div>
            <span className="text-sm text-text-secondary">Thinking through the response…</span>
          </div>
        </div>
      </div>
    </div>
  );
}
