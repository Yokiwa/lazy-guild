import type { Equipped, Species, Stage } from '@lazy-guild/core';
import { useTranslation } from 'react-i18next';
import { Background } from '../art/backgrounds';
import { Companion } from '../art/Companion';

interface Props {
  species: Species;
  stage: Stage;
  equipped?: Equipped;
  line?: string;
  size?: number;
  scene?: boolean;
}

export function CompanionBubble({ species, stage, equipped, line, size = 150, scene = true }: Props) {
  const { t } = useTranslation();
  return (
    <div className={scene ? 'companion-stage with-scene' : 'companion-stage'}>
      {scene && <Background id={equipped?.background ?? null} />}
      {line && (
        <p className="bubble" aria-live="polite">
          {line}
        </p>
      )}
      <Companion
        species={species}
        stage={stage}
        equipped={equipped}
        size={size}
        label={`${t(`species.${species}`)} · ${t(`stage.${stage}`)}`}
      />
    </div>
  );
}
