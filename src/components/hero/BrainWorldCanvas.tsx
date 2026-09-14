"use client";

// ─── BrainWorldCanvas ────────────────────────────────────────────────────────
// The site's Three.js brain (showcase/BrainCanvas.tsx), lifted for the hero
// phone: same scene, camera (0,10,20), atomic model (nucleus r1.5, category
// globes r0.5 with EdgesGeometry wireframes, moons on sub-orbits), fog, and
// OrbitControls auto-rotate. Differences: categories come in as props, `dark`
// inverts ink/paper (black page, off-white nucleus + lines — the app's dark
// theme), each category carries an invisible CSS2D anchor with
// data-tap="node-<key>" so the scene's tap ripple can find it, and the spin can
// be paused (the world holds still once a node is picked).

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { isWebGLAvailable } from "@/lib/webgl";

export type BrainCategory = { key: string; label: string; children: string[] };

export default function BrainWorldCanvas({
  centerLabel,
  categories,
  dark = true,
  selected = null,
  spinning = true,
}: {
  centerLabel: string;
  categories: BrainCategory[];
  dark?: boolean;
  selected?: string | null;
  spinning?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const labelsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isWebGLAvailable()) return;

    const paper = dark ? 0x000000 : 0xffffff;
    const ink = dark ? 0xede9dc : 0x000000;
    const inkCss = dark ? "#ede9dc" : "#000000";
    const paperCss = dark ? "#000000" : "#ffffff";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(paper);
    scene.fog = new THREE.FogExp2(paper, 0.02);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 10, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0px";
    labelRenderer.domElement.style.pointerEvents = "none";
    labelRenderer.domElement.style.zIndex = "1";
    container.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableRotate = false;
    controlsRef.current = controls;

    const disposables: { dispose: () => void }[] = [];

    function createNode(type: "nucleus" | "category" | "item", labelText: string, position: THREE.Vector3, parentObj: THREE.Mesh | null, key?: string) {
      const isNucleus = type === "nucleus";
      const size = isNucleus ? 1.5 : 0.5;
      const geometry = new THREE.SphereGeometry(size, 32, 32);
      const material = new THREE.MeshBasicMaterial({ color: isNucleus ? ink : paper });
      disposables.push(geometry, material);
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.copy(position);

      if (!isNucleus) {
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMat = new THREE.LineBasicMaterial({ color: ink });
        disposables.push(edges, lineMat);
        sphere.add(new THREE.LineSegments(edges, lineMat));
      }

      const div = document.createElement("div");
      div.textContent = labelText;
      div.style.cssText = `
        color: ${inkCss};
        font-family: var(--font-playfair), 'Playfair Display', serif;
        font-size: ${isNucleus ? "24px" : "14px"};
        font-weight: ${isNucleus ? "bold" : "normal"};
        text-shadow: 0 0 2px ${paperCss};
        pointer-events: none;
        white-space: nowrap;
      `;
      const label = new CSS2DObject(div);
      label.position.set(0, isNucleus ? 1.8 : 0.8, 0);
      sphere.add(label);

      if (key) {
        // invisible tap anchor at the globe's center (52×52, like BrainWorld's HIT)
        const hit = document.createElement("div");
        hit.dataset.tap = `node-${key}`;
        hit.style.cssText = "width:52px;height:52px;border-radius:50%;pointer-events:none;";
        const anchor = new CSS2DObject(hit);
        anchor.position.set(0, 0, 0);
        sphere.add(anchor);
        labelsRef.current.set(key, div);
      }

      scene.add(sphere);

      if (parentObj) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([parentObj.position.clone(), position.clone()]);
        const lineMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.2 });
        disposables.push(lineGeo, lineMat);
        scene.add(new THREE.Line(lineGeo, lineMat));
      }
      return sphere;
    }

    const nucleus = createNode("nucleus", centerLabel, new THREE.Vector3(0, 0, 0), null);
    const orbitRadius = 6;
    const subOrbitRadius = 2.5;
    categories.forEach((cat, i) => {
      const angle = (i / categories.length) * Math.PI * 2;
      const x = Math.cos(angle) * orbitRadius;
      const z = Math.sin(angle) * orbitRadius;
      const catNode = createNode("category", cat.label, new THREE.Vector3(x, 0, z), nucleus, cat.key);
      cat.children.forEach((childLabel, j) => {
        const subAngle = (j / cat.children.length) * Math.PI * 2;
        const dirX = x / orbitRadius;
        const dirZ = z / orbitRadius;
        const perpX = -dirZ;
        const perpZ = dirX;
        const sx = x + (Math.cos(subAngle) * perpX + Math.sin(subAngle) * dirX * 0.5) * subOrbitRadius;
        const sy = Math.sin(subAngle) * subOrbitRadius * 0.7;
        const sz = z + (Math.cos(subAngle) * perpZ + Math.sin(subAngle) * dirZ * 0.5) * subOrbitRadius;
        createNode("item", childLabel, new THREE.Vector3(sx, sy, sz), catNode);
      });
    });

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      labelRenderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    const labels = labelsRef.current;
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(raf);
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      if (container.contains(labelRenderer.domElement)) container.removeChild(labelRenderer.domElement);
      labels.clear();
      controlsRef.current = null;
    };
  }, [dark, centerLabel, categories]);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = spinning;
  }, [spinning]);

  useEffect(() => {
    labelsRef.current.forEach((div, key) => {
      const on = key === selected;
      div.style.fontSize = on ? "16px" : "14px";
      div.style.fontWeight = on ? "bold" : "normal";
    });
  }, [selected]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
