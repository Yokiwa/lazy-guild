import type { Equipped, Species, Stage } from '@lazy-guild/core';
import { Cape, Hat } from './cosmetics';

interface Props {
  species: Species;
  stage: Stage;
  equipped?: Equipped;
  size?: number;
  label?: string;
}

const SCALE: Record<Stage, number> = { baby: 0.78, teen: 0.9, adult: 1 };

/** Original companions: a slime, a fox-fire spirit and a little drake, each in three growth stages. */
export function Companion({ species, stage, equipped, size = 160, label }: Props) {
  const s = SCALE[stage];
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={label ?? `${species} ${stage}`}
      className={`companion companion-${species}`}
    >
      <ellipse cx="100" cy="186" rx={58 * s} ry="8" fill="rgba(0,0,0,0.15)" />
      <g transform={`translate(100 186) scale(${s}) translate(-100 -186)`}>
        {equipped?.cape && <Cape id={equipped.cape} />}
        {species === 'slime' && <Slime stage={stage} />}
        {species === 'foxfire' && <Foxfire stage={stage} />}
        {species === 'drake' && <Drake stage={stage} />}
        {equipped?.hat && <Hat id={equipped.hat} />}
      </g>
    </svg>
  );
}

function Eyes({ y = 112, gap = 22, r = 7 }: { y?: number; gap?: number; r?: number }) {
  return (
    <g fill="#2b2140">
      <circle cx={100 - gap} cy={y} r={r} />
      <circle cx={100 + gap} cy={y} r={r} />
      <circle cx={100 - gap + 2.5} cy={y - 2.5} r={r / 3} fill="#fff" />
      <circle cx={100 + gap + 2.5} cy={y - 2.5} r={r / 3} fill="#fff" />
    </g>
  );
}

function Smile({ y = 130 }: { y?: number }) {
  return <path d={`M88 ${y} Q100 ${y + 10} 112 ${y}`} stroke="#2b2140" strokeWidth="4" fill="none" strokeLinecap="round" />;
}

function Blush({ y = 126 }: { y?: number }) {
  return (
    <g fill="#f29b9b" opacity="0.6">
      <ellipse cx="66" cy={y} rx="9" ry="5" />
      <ellipse cx="134" cy={y} rx="9" ry="5" />
    </g>
  );
}

function Slime({ stage }: { stage: Stage }) {
  const body = stage === 'adult' ? '#4fc3a1' : stage === 'teen' ? '#62cba8' : '#7fd6b6';
  return (
    <g>
      {stage === 'adult' && (
        <ellipse cx="100" cy="58" rx="34" ry="7" fill="none" stroke="#e5b558" strokeWidth="5" />
      )}
      <path d="M30 180 C24 120 60 70 100 70 C140 70 176 120 170 180 Z" fill={body} />
      <path d="M48 120 C52 96 70 82 88 80" stroke="#fff" strokeWidth="8" strokeLinecap="round" fill="none" opacity="0.5" />
      {stage !== 'baby' && <path d="M100 70 C96 54 106 46 114 50 C108 56 106 62 100 70 Z" fill="#3e9e6e" />}
      <Eyes y={124} />
      <Blush y={140} />
      <Smile y={144} />
    </g>
  );
}

function Foxfire({ stage }: { stage: Stage }) {
  const tails = stage === 'adult' ? 3 : stage === 'teen' ? 2 : 1;
  return (
    <g>
      {Array.from({ length: tails }, (_, i) => {
        const angle = (i - (tails - 1) / 2) * 28;
        return (
          <g key={i} transform={`rotate(${angle} 100 160)`}>
            <path d="M100 160 C150 150 170 100 150 60 C146 92 130 112 104 132 Z" fill="#f4a24a" />
            <path d="M150 60 C162 74 164 92 156 104 C152 90 150 76 150 60 Z" fill="#ffe08a" />
          </g>
        );
      })}
      <path d="M52 180 C50 140 68 118 100 118 C132 118 150 140 148 180 Z" fill="#f08a3c" />
      <path d="M58 106 L44 48 L86 84 Z" fill="#f08a3c" />
      <path d="M142 106 L156 48 L114 84 Z" fill="#f08a3c" />
      <path d="M58 98 L52 64 L76 86 Z" fill="#ffd9b0" />
      <path d="M142 98 L148 64 L124 86 Z" fill="#ffd9b0" />
      <ellipse cx="100" cy="112" rx="50" ry="40" fill="#f08a3c" />
      <path d="M70 124 C80 150 120 150 130 124 C120 136 80 136 70 124 Z" fill="#fff4e6" />
      <Eyes y={108} gap={20} r={6} />
      <circle cx="100" cy="124" r="5" fill="#2b2140" />
      {stage !== 'baby' && <path d="M100 72 C92 60 100 46 108 40 C106 54 116 60 100 72 Z" fill="#ffcc4d" />}
    </g>
  );
}

function Drake({ stage }: { stage: Stage }) {
  const wing = stage === 'adult' ? 1.35 : stage === 'teen' ? 1.1 : 0.85;
  return (
    <g>
      <g transform={`translate(100 120) scale(${wing}) translate(-100 -120)`}>
        <path d="M66 120 L18 80 L30 128 L12 140 L60 146 Z" fill="#8e6bd1" />
        <path d="M134 120 L182 80 L170 128 L188 140 L140 146 Z" fill="#8e6bd1" />
      </g>
      <path d="M140 172 C170 170 182 150 176 134 C170 150 158 158 136 160 Z" fill="#7a55c4" />
      <ellipse cx="100" cy="150" rx="46" ry="36" fill="#9b7be0" />
      <ellipse cx="100" cy="156" rx="28" ry="24" fill="#f3e7c9" />
      <ellipse cx="100" cy="104" rx="44" ry="38" fill="#9b7be0" />
      <path d="M72 76 L64 48 L84 70 Z" fill="#f3e7c9" />
      <path d="M128 76 L136 48 L116 70 Z" fill="#f3e7c9" />
      {stage === 'adult' && <path d="M84 70 L100 54 L116 70 Z" fill="#e5b558" />}
      <Eyes y={100} gap={18} r={7} />
      <ellipse cx="92" cy="120" rx="3" ry="2" fill="#2b2140" />
      <ellipse cx="108" cy="120" rx="3" ry="2" fill="#2b2140" />
      <Smile y={126} />
    </g>
  );
}
