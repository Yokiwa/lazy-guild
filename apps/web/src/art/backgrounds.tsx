/** Full-width scene behind the companion. null = the default guild hall. */
export function Background({ id }: { id: string | null }) {
  return (
    <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className="scene" aria-hidden="true">
      {id === 'bg_forest' ? <Forest /> : id === 'bg_town' ? <Town /> : id === 'bg_demon_castle' ? <DemonCastle /> : <Hall />}
    </svg>
  );
}

function Hall() {
  return (
    <g>
      <rect width="400" height="220" fill="#e9d8b8" />
      <rect y="160" width="400" height="60" fill="#b98a5a" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={i * 50} y="160" width="2" height="60" fill="#9c7046" />
      ))}
      <path d="M60 20 h40 v70 l-20 -14 l-20 14 Z" fill="#c2453a" />
      <path d="M300 20 h40 v70 l-20 -14 l-20 14 Z" fill="#4f7fe0" />
      <circle cx="80" cy="48" r="9" fill="#e5b558" />
      <circle cx="320" cy="48" r="9" fill="#e5b558" />
      <rect x="160" y="30" width="80" height="56" rx="6" fill="#7a5a3a" />
      <rect x="168" y="38" width="64" height="40" fill="#f6efe2" />
      <path d="M176 50 h48 M176 60 h36 M176 70 h42" stroke="#b98a5a" strokeWidth="3" />
    </g>
  );
}

function Forest() {
  return (
    <g>
      <rect width="400" height="220" fill="#cfe8d4" />
      <circle cx="330" cy="50" r="26" fill="#fff3c4" />
      {[20, 90, 160, 250, 320, 380].map((x, i) => (
        <g key={x}>
          <rect x={x - 5} y={110 + (i % 2) * 10} width="10" height="60" fill="#7a5a3a" />
          <circle cx={x} cy={100 + (i % 2) * 10} r={36} fill={i % 2 ? '#4f9e63' : '#3e8a54'} />
        </g>
      ))}
      <rect y="168" width="400" height="52" fill="#8cc084" />
    </g>
  );
}

function Town() {
  return (
    <g>
      <rect width="400" height="220" fill="#cfe0f5" />
      {[
        [20, 90, '#e0614f'],
        [110, 70, '#4f7fe0'],
        [200, 96, '#e5b558'],
        [290, 76, '#3e9e6e'],
      ].map(([x, h, c]) => (
        <g key={x as number}>
          <rect x={x as number} y={170 - (h as number)} width="80" height={h as number} fill="#f6efe2" stroke="#b9a98a" />
          <path d={`M${(x as number) - 6} ${170 - (h as number)} L${(x as number) + 40} ${130 - (h as number)} L${(x as number) + 86} ${170 - (h as number)} Z`} fill={c as string} />
          <rect x={(x as number) + 30} y={140} width="20" height="30" fill="#7a5a3a" />
        </g>
      ))}
      <rect y="170" width="400" height="50" fill="#c9b895" />
    </g>
  );
}

function DemonCastle() {
  return (
    <g>
      <rect width="400" height="220" fill="#3b2a5c" />
      <circle cx="320" cy="46" r="22" fill="#f3e7c9" />
      {[30, 70, 120, 260, 300, 350].map((x, i) => (
        <circle key={x} cx={x} cy={20 + (i % 3) * 18} r="1.6" fill="#fff" />
      ))}
      <path d="M120 170 V80 l20 -24 l20 24 V60 l40 -40 l40 40 V80 l20 -24 l20 24 V170 Z" fill="#1c1726" />
      <rect x="188" y="120" width="24" height="50" rx="12" fill="#e0614f" />
      <rect y="170" width="400" height="50" fill="#2a2238" />
    </g>
  );
}
