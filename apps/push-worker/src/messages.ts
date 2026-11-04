import type { Lang } from '@lazy-guild/core';

// Generic copy only: the push service never knows quest names.
const SLOT: Record<Lang, { title: string; body: string }> = {
  zh: { title: '⚔️ 新的委托到了！', body: '点开挑一个吧' },
  en: { title: '⚔️ A new quest has arrived!', body: 'Tap to pick one' },
};
const CONFIRM: Record<Lang, { title: string; body: string }> = {
  zh: { title: '委托完成了吗？', body: '点开告诉公会结果' },
  en: { title: 'Quest finished?', body: 'Tap to report back' },
};

const pick = (lang: string): Lang => (lang === 'en' ? 'en' : 'zh');
export const slotMessage = (lang: string) => SLOT[pick(lang)];
export const confirmMessage = (lang: string) => CONFIRM[pick(lang)];
