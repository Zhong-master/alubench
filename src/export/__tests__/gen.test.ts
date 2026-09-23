import { describe, it, expect } from 'vitest';
import { DEFAULT_STATE } from '../../state';
import { generateExportHtml } from '../../utils/exportHtml';
import { buildSceneGeometry } from '../../geometry';
import { makeFourLayerScene, makeLayer } from '../../geometry/__tests__/helpers';

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

  it('内联 DATA 转义 < 与行分隔符：工程文件里的 </script> 无法提前闭合脚本块', () => {
    const evil = {
      ...DEFAULT_STATE,
      layers: [
        makeLayer({
          id: '</script><script>alert(1)</script>',
          type: 'shelf',
          elevation: 550,
        }),
      ],
    };
    const out = generateExportHtml(evil);
    // 注入串被转义为 \u003c...，不会形成新的 <script> 标签
    expect(out).not.toContain('</script><script>alert(1)');
    expect(out).toContain('\\u003c/script');
  });

  it('层 ID 隔板编号按标高降序，与数组插入顺序无关（与底栏/3D 标签一致）', () => {
    // 插入顺序：低隔板在前。旧实现按数组下标编号 → 导出端 #1 会指向低隔板，与界面相反。
    const state = {
      ...DEFAULT_STATE,
      layers: [
        makeLayer({ id: 'low', type: 'shelf', elevation: 300 }),
        makeLayer({ id: 'high', type: 'shelf', elevation: 900 }),
      ],
    };
    const out = generateExportHtml(state);
    const json = out.slice(out.indexOf('const DATA = ') + 'const DATA = '.length);
    const data = JSON.parse(json.slice(0, json.indexOf(';\n'))) as {
      layerGeom: { layerId: string; shelfNumber: number }[];
    };
    expect(data.layerGeom.map((l) => [l.layerId, l.shelfNumber])).toEqual([
      ['low', 2],
      ['high', 1],
    ]);
  });

  it('传入已算好的几何时输出与自建几何完全一致（UI 复用一份实例不改变结果）', () => {
    const prebuilt = generateExportHtml(state, buildSceneGeometry(state));
    expect(prebuilt).toBe(html);
  });
});
