import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControlsLike } from './threeTypes';

const CameraController: React.FC = () => {
  const { camera, controls } = useThree();
  const rafRef = useRef<number>(0);
  const initialPos = useRef<THREE.Vector3 | null>(null);
  const initialTarget = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!initialPos.current) {
      initialPos.current = camera.position.clone();
      if (controls) {
        const c = controls as unknown as OrbitControlsLike;
        initialTarget.current = c.target.clone();
      }
    }
  }, [camera, controls]);

  useEffect(() => {
    const onSetTarget = (e: Event) => {
      const { position } = (e as CustomEvent).detail as { position: [number, number, number] };
      cancelAnimationFrame(rafRef.current);
      const startPos = camera.position.clone();
      const targetPos = new THREE.Vector3(...position);
      const startTime = performance.now();
      const duration = 400;
      const animate = (time: number) => {
        const t = Math.min((time - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(startPos, targetPos, ease);
        camera.lookAt(0, 0, 0);
        if (t < 1) rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    };

    const onReset = () => {
      if (initialPos.current) {
        cancelAnimationFrame(rafRef.current);
        const startPos = camera.position.clone();
        const targetPos = initialPos.current.clone();
        const lookAt = initialTarget.current?.clone() || new THREE.Vector3(0, 0, 0);
        const startTime = performance.now();
        const duration = 400;
        const animate = (time: number) => {
          const t = Math.min((time - startTime) / duration, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          camera.position.lerpVectors(startPos, targetPos, ease);
          camera.lookAt(lookAt);
          if (t < 1) rafRef.current = requestAnimationFrame(animate);
        };
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    window.addEventListener('set-camera-target', onSetTarget);
    window.addEventListener('reset-camera', onReset);

    return () => {
      window.removeEventListener('set-camera-target', onSetTarget);
      window.removeEventListener('reset-camera', onReset);
      cancelAnimationFrame(rafRef.current);
    };
  }, [camera, controls]);

  return null;
};

export default CameraController;
