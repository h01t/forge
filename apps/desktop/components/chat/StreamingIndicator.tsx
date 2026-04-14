'use client';

export default function StreamingIndicator() {
  return (
    <div className="message-assistant p-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <span className="text-sm font-display text-primary-500">ASSISTANT</span>
        <div className="loading-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
