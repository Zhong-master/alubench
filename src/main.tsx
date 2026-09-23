// ⚠️ React 19 适配：必须在任何 Semi 组件导入前注入 createRoot（Modal.confirm/Toast 依赖）
import '@douyinfe/semi-ui/react19-adapter';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@douyinfe/semi-ui/lib/es/_base/base.css';
import './index.css';
import { LocaleProvider } from '@douyinfe/semi-ui';
import en_US from '@douyinfe/semi-ui/lib/es/locale/source/en_US';
import zh_CN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN';
import App from './App';
import { I18nProvider, useI18n } from './i18n';

/**
 * Semi 组件库自身的文案（表格空态「暂无数据」、分页、Select 空选项等）由它自己的
 * locale 决定，与我们的文案表无关 —— 必须跟着界面语言一起切，否则英文界面里会
 * 突然冒出一句中文「暂无数据」。
 */
const SemiLocale: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { locale } = useI18n();
  return <LocaleProvider locale={locale === 'en' ? en_US : zh_CN}>{children}</LocaleProvider>;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <SemiLocale>
        <App />
      </SemiLocale>
    </I18nProvider>
  </React.StrictMode>
);

// PWA：注册 Service Worker，安装到桌面后离线可用。
// ⚠️ 只在生产构建注册 —— dev server 下 SW 会缓存模块请求，导致改代码不生效且极难排查。
// ⚠️ 只在 http(s) 下注册（Service Worker 在 file:// 与部分内嵌 webview 中不可用，静默跳过即可）。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 注册失败不影响应用本身（离线能力降级，其余功能照常） */
    });
  });
}
