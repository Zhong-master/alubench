import { describe, it, expect } from 'vitest';
import { DEFAULT_STATE } from '../../state';
import { generateExportHtml } from '../../utils/exportHtml';
import { makeFourLayerScene } from '../../geometry/__tests__/helpers';

/**
 * 导出 HTML 结构与离线内嵌验证。
 * 三端（SceneView/exportHtml/bom）消费同一共享内核，本测试锁定导出端结构不回归。
 */
describe('generateExportHtml — 导出结构', () => {
  const state = { ...DEFAULT_STATE, layers: Object.values(makeFourLayerScene()) };
  const html = generateExportHtml(state);

  it('离线内嵌 three（无 CDN 引用），含渲染引擎特征', () => {
    expect(html).not.toContain('cdnjs.cloudflare.com');
    expect(html).not.toContain('cdn.jsdelivr.net');
    expect(html).toContain('WebGLRenderer');
    // 内嵌 r128 构建：three.min.js 渲染引擎 + OrbitControls 全局定义
    expect(html).toContain('OrbitControls');
  });

  it('含「标」显示控制按钮与分组逻辑', () => {
    expect(html).toContain('id="label-btn"');
    expect(html).toContain('chk-dims');
    expect(html).toContain('chk-ids');
    expect(html).toContain('dimGroup');
    expect(html).toContain('idGroup');
  });

  it('DATA 注入共享内核几何（frameBeams + layerGeom 含板材/物品占位）', () => {
    expect(html).toContain('"frameBeams"');
    expect(html).toContain('"layerGeom"');
    expect(html).toContain('"board"');
    expect(html).toContain('"placements"');
  });

  it('尺寸标注与层 ID 标签加入可切换分组', () => {
    // 尺寸标注归入 dimGroup（.add），不再直接 scene.add
    const dimSection = html.slice(html.indexOf('// ─── 尺寸标注'));
    expect(dimSection).toContain('dimGroup.add');
    expect(dimSection).not.toContain('scene.add(lenLabel)');
    expect(dimSection).not.toContain('scene.add(depLabel)');
  });
});
