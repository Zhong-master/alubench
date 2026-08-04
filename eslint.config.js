import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      // React 19 编译器时代的激进规则与本代码库的既有惯用法冲突，按项目实际显式关闭：
      // - immutability: R3F 场景图是外部系统，在 effect 内命令式修改 scene 是 @react-three/fiber 的标准用法
      // - refs: 撤销/重做历史栈与跨渲染模块级状态是本库有意的命令式模式（见 CLAUDE.md）
      // - set-state-in-effect: localStorage 草稿恢复是标准的 mount 期一次性同步
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
);
