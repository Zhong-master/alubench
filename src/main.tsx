// ⚠️ React 19 适配：必须在任何 Semi 组件导入前注入 createRoot（Modal.confirm/Toast 依赖）
import '@douyinfe/semi-ui/react19-adapter';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@douyinfe/semi-ui/lib/es/_base/base.css';
import './index.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
