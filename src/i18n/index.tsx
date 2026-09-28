import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DICTS, type MessageKey } from './messages';

/**
 * 国际化（无第三方依赖）
 *
 * - React 组件用 `useT()` 取翻译函数；语言状态由 `I18nProvider` 持有，持久化在 localStorage。
 * - **非 React 模块不读全局**：`translate(locale, key, vars)` 是纯函数，BOM / 导出 / 校验等
 *   模块显式接收 `locale` 参数（默认 'zh'，因此既有纯函数测试不需要改动）。
 * - 首次访问按浏览器语言自动选择，用户手动切换后以用户选择为准。
 */

export type Locale = 'zh' | 'en';
export const LOCALES: Locale[] = ['zh', 'en'];
export const LOCALE_STORAGE_KEY = 'alubench-locale';

/** 占位符插值：`{n}` / `{name}` → 传入值 */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole
  );
}

/** 纯函数翻译：任何模块都能用（不依赖 React） */
export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const dict = DICTS[locale] ?? DICTS.zh;
  const template = (dict as Record<string, string>)[key] ?? DICTS.zh[key] ?? key;
  return interpolate(template, vars);
}

/** 浏览器语言 → 支持的 locale（非中文一律给英文，避免出现第三种语言） */
/**
 * 浏览器语言 → 界面语言。
 * 显式支持传入语言列表（单测用）；不传时读 navigator。
 * 规则：zh* → zh；其它已知语言 → en；**完全取不到语言信息**时保持默认 zh
 * （SSR / 老浏览器场景下不要擅自把中文用户切成英文）。
 */
export function detectLocale(langs?: readonly string[]): Locale {
  const list =
    langs && langs.length
      ? langs
      : typeof navigator === 'undefined'
        ? []
        : navigator.languages && navigator.languages.length
          ? navigator.languages
          : [navigator.language];
  for (const lang of list) {
    if (!lang) continue;
    const lower = lang.toLowerCase();
    if (lower.startsWith('zh')) return 'zh';
    if (lower.startsWith('en')) return 'en';
  }
  return list.some((l) => !!l) ? 'en' : 'zh';
}

export function readStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw === 'zh' || raw === 'en') return raw;
  } catch {
    /* 隐私模式下 localStorage 不可用 —— 退回自动检测 */
  }
  return detectLocale();
}

export interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* 存不下也不影响本次会话 */
    }
  }, []);

  // 同步 <html lang>（影响字体回退、朗读、翻译提示）与页面标题
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title = translate(locale, 'app.title');
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale, t: (key, vars) => translate(locale, key, vars) }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n 必须在 <I18nProvider> 内使用');
  return value;
}

/** 组件里最常用的取用方式 */
export function useT(): I18nValue['t'] {
  return useI18n().t;
}
