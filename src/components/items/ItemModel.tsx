import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { ItemType } from './types';
import type { Item3DProps } from './types';
import type { ItemPrimitive } from '../../geometry/itemModel';
import { getItemPrimitives } from '../../geometry/itemModel';

function materialProps(p: ItemPrimitive): THREE.MeshStandardMaterialParameters {
  return {
    color: p.color,
    roughness: p.roughness ?? 0.5,
    metalness: p.metalness ?? 0.1,
    transparent: p.transparent,
    opacity: p.opacity,
    emissive: p.emissive,
    emissiveIntensity: p.emissiveIntensity,
    side: p.side === 'double' ? THREE.DoubleSide : p.side === 'back' ? THREE.BackSide : THREE.FrontSide,
  };
}

/** 图元 args 透传（各 kind 的几何 tuple 类型不同，统一按任意数组交给 R3F 构造） */
const argsOf = (p: ItemPrimitive) => p.args as never;

/** 单个图元渲染（共享物品几何描述） */
const Primitive: React.FC<{ p: ItemPrimitive }> = ({ p }) => {
  const pos = p.pos ?? [0, 0, 0];
  const rot = p.rot ?? [0, 0, 0];

  if (p.kind === 'roundedBox') {
    return (
      <RoundedBox args={argsOf(p)} radius={p.radius ?? 0.004} position={pos} rotation={rot}>
        <meshStandardMaterial {...materialProps(p)} />
      </RoundedBox>
    );
  }

  return (
    <mesh position={pos} rotation={rot}>
      {p.kind === 'box' && <boxGeometry args={argsOf(p)} />}
      {p.kind === 'cylinder' && <cylinderGeometry args={argsOf(p)} />}
      {p.kind === 'sphere' && <sphereGeometry args={argsOf(p)} />}
      {p.kind === 'torus' && <torusGeometry args={argsOf(p)} />}
      {p.kind === 'plane' && <planeGeometry args={argsOf(p)} />}
      {p.kind === 'circle' && <circleGeometry args={argsOf(p)} />}
      <meshStandardMaterial {...materialProps(p)} />
    </mesh>
  );
};

/**
 * 物品 3D 模型（统一实现）。
 * 模型外观由共享几何描述 getItemPrimitives(type) 决定，
 * 导出端 createItemMesh 渲染同一描述，两端视觉一致。
 */
export const ItemModel: React.FC<Item3DProps & { type: ItemType }> = ({ type, scale = 1 }) => {
  const primitives = useMemo(() => getItemPrimitives(type), [type]);
  return (
    <group scale={[scale, scale, scale]}>
      {primitives.map((p, i) => <Primitive key={i} p={p} />)}
    </group>
  );
};
