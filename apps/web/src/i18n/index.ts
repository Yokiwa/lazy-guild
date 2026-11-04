import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Lang } from '@lazy-guild/core';
import { kvGet, kvSet } from '../db';
import { pushClient } from '../push/client';
import en from './en.json';
import zh from './zh.json';

export const resources = { zh: { translation: zh }, en: { translation: en } } as const;

export function detectLang(): Lang {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export async function initI18n(lang?: Lang): Promise<typeof i18n> {
  const chosen = lang ?? (await kvGet<Lang>('lang')) ?? detectLang();
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng: chosen,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      returnObjects: true,
    });
  } else {
    await i18n.changeLanguage(chosen);
  }
  document.documentElement.lang = chosen === 'zh' ? 'zh-CN' : 'en';
  return i18n;
}

export function currentLang(): Lang {
  return i18n.language === 'zh' ? 'zh' : 'en';
}

export async function setLang(lang: Lang): Promise<void> {
  await kvSet('lang', lang);
  await i18n.changeLanguage(lang);
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  await pushClient.updateLang(lang);
}

export default i18n;
