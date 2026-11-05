/** Cosmetic overlays drawn in the companion's 200×200 coordinate space. */
export function Hat({ id }: { id: string }) {
  switch (id) {
    case 'hat_leaf':
      return (
        <g>
          <path d="M100 66 C84 40 100 22 122 26 C120 48 112 60 100 66 Z" fill="#5cb85c" />
          <path d="M100 66 C106 50 112 40 120 30" stroke="#2f7a3a" strokeWidth="3" fill="none" />
        </g>
      );
    case 'hat_witch':
      return (
        <g>
          <ellipse cx="100" cy="72" rx="58" ry="10" fill="#3b2a5c" />
          <path d="M70 72 L112 8 L130 72 Z" fill="#3b2a5c" />
          <rect x="72" y="60" width="56" height="8" fill="#e5b558" />
        </g>
      );
    case 'hat_knight':
      return (
        <g>
          <path d="M56 84 C56 46 144 46 144 84 Z" fill="#b8c2cc" />
          <rect x="56" y="78" width="88" height="8" fill="#8a96a3" />
          <path d="M100 46 C96 30 108 22 118 18 C112 30 112 38 100 46 Z" fill="#e0614f" />
        </g>
      );
    case 'hat_crown':
      return (
        <g>
          <path d="M66 74 L70 40 L86 58 L100 34 L114 58 L130 40 L134 74 Z" fill="#e5b558" stroke="#b07f1e" strokeWidth="3" />
          <circle cx="100" cy="60" r="5" fill="#e0614f" />
        </g>
      );
    default:
      return null;
  }
}

export function Cape({ id }: { id: string }) {
  const colors: Record<string, [string, string]> = {
    cape_traveler: ['#8a5a3c', '#6d4429'],
    cape_guild: ['#2b2140', '#e5b558'],
    cape_starlight: ['#5b3fa0', '#ffe08a'],
  };
  const c = colors[id];
  if (!c) return null;
  return (
    <g>
      <path d="M58 110 C40 150 36 178 34 184 L166 184 C164 178 160 150 142 110 Z" fill={c[0]} />
      <path d="M34 184 L166 184" stroke={c[1]} strokeWidth="6" />
      {id === 'cape_starlight' &&
        [
          [60, 160],
          [130, 150],
          [96, 172],
        ].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" fill={c[1]} />)}
    </g>
  );
}

