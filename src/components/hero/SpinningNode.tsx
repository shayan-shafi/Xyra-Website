"use client";

// ─── SpinningNode ────────────────────────────────────────────────────────────
// One brain node, slowly turning: the sphere + EdgesGeometry wireframe and
// camera from showcase/FinanceNode.tsx, on a transparent canvas so it can sit
// on any screen. `dark` inverts the ink like the phone's BrainWorldCanvas.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { isWebGLAvailable } from "@/lib/webgl";

export default function SpinningNode({ size = 72, dark = true, speed = 0.003 }: { size?: number; dark?: boolean; speed?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !isWebGLAvailable()) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0.5, 3.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const geo = new THREE.SphereGeometry(0.5, 32, 32);
    const mat = new THREE.MeshBasicMaterial({ color: dark ? 0x000000 : 0xffffff });
    const sphere = new THREE.Mesh(geo, mat);
    const edges = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({ color: dark ? 0xede9dc : 0x000000 });
    sphere.add(new THREE.LineSegments(edges, lineMat));
    scene.add(sphere);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      sphere.rotation.y += speed;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      geo.dispose();
      mat.dispose();
      edges.dispose();
      lineMat.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [size, dark, speed]);

  return <div ref={ref} style={{ width: size, height: size }} />;
}
