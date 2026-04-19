'use client';

import Image from 'next/image';

interface PantheonForgeBrandProps {
  compact?: boolean;
}

export default function PantheonForgeBrand({
  compact = false,
}: PantheonForgeBrandProps) {
  return (
    <div className={`brand-lockup ${compact ? 'brand-lockup--compact' : ''}`}>
      <div className="brand-mark relative" aria-hidden="true">
        <Image
          src="/brand/pantheon-forge-mark.svg"
          alt=""
          fill
          sizes={compact ? '48px' : '56px'}
          className="object-cover"
        />
      </div>
      {!compact ? (
        <div className="min-w-0">
          <p className="brand-wordmark">Pantheon Forge</p>
          <p className="brand-submark">Unified Agent Command Deck</p>
        </div>
      ) : null}
    </div>
  );
}
