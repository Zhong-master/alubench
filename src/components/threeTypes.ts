import type * as THREE from 'three';

/** R3F `useThree().controls` 的最小结构类型（实际为 drei OrbitControls 实例） */
export interface OrbitControlsLike {
  target: THREE.Vector3;
  update: () => void;
}
