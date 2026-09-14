"use client";

// ─── BrainWorldCanvas ────────────────────────────────────────────────────────
// The Three.js brain for the hero phone. Bones = the site's showcase/BrainCanvas
// (camera (0,10,20), nucleus r1.5, category globes r0.5 on a ring r6, moons on
// sub-orbits r2.5, fog, OrbitControls auto-rotate). Skin = the newer dark
// "planets" look: a bright glowing nucleus, hollow lat/long wireframe globes
// (BrainOrb's LineLoop grid — no triangle diagonals), faint orbit paths, a few
// stars, lowercase serif labels with an italic "you" under the sun.
// Each category carries an invisible CSS2D anchor with data-tap="node-<key>"
// so the scene's tap ripple can find it in 3D; the spin pauses on selection.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { isWebGLAvailable } from "@/lib/webgl";

export type BrainCategory = { key: string; label: string; children: string[] };

const ORBIT_R = 6;
const SUB_ORBIT_R = 2.5;
const SEG = 48;

// soft radial halo for the additive glow sprite
function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,247,228,0.95)");
  grd.addColorStop(0.22, "rgba(255,247,228,0.5)");
  grd.addColorStop(0.55, "rgba(255,247,228,0.1)");
  grd.addColorStop(1, "rgba(255,247,228,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

// BrainOrb's globe: true latitude/longitude rings as LineLoops.
function latLongGlobe(R: number, mat: THREE.LineBasicMaterial, onGeo: (g: THREE.BufferGeometry) => void): THREE.Group {
  const g = new THREE.Group();
  const ring = (pts: THREE.Vector3[]) => {
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    onGeo(geo);
    g.add(new THREE.LineLoop(geo, mat));
  };
  for (let i = 1; i < 7; i++) {
    const phi = (i / 7) * Math.PI;
    const r = Math.sin(phi) * R;
    const y = Math.cos(phi) * R;
    ring(Array.from({ length: SEG }, (_, j) => { const t = (j / SEG) * Math.PI * 2; return new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r); }));
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI;
    ring(Array.from({ length: SEG }, (_, j) => { const t = (j / SEG) * Math.PI * 2; return new THREE.Vector3(Math.sin(t) * R * Math.cos(a), Math.cos(t) * R, Math.sin(t) * R * Math.sin(a)); }));
  }
  return g;
}

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
    const ink = dark ? 0xe6e1d3 : 0x0a0a0a;
    const sun = dark ? 0xfff6e0 : 0x0a0a0a;
    const inkCss = dark ? "#ede9dc" : "#0a0a0a";
    const paperCss = dark ? "#000000" : "#ffffff";

    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(d: T): T => { disposables.push(d); return d; };

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

    // shared materials
    const globeLineMat = track(new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.55 }));
    const occluderMat = track(new THREE.MeshBasicMaterial({ color: paper }));
    const spokeMat = track(new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.14 }));
    const orbitMat = track(new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.09 }));

    const label = (text: string, css: string, y: number) => {
      const div = document.createElement("div");
      div.textContent = text;
      div.style.cssText = `color:${inkCss};font-family:var(--font-playfair),'Playfair Display',serif;text-shadow:0 0 3px ${paperCss};pointer-events:none;white-space:nowrap;${css}`;
      const obj = new CSS2DObject(div);
      obj.position.set(0, y, 0);
      return { div, obj };
    };

    // ── the sun (nucleus): bright, fog-proof, with an additive halo ──
    const nucleusGeo = track(new THREE.SphereGeometry(1.5, 48, 48));
    const nucleusMat = track(new THREE.MeshBasicMaterial({ color: sun, fog: false }));
    const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
    scene.add(nucleus);
    if (dark) {
      const tex = track(glowTexture());
      const glowMat = track(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1, fog: false }));
      const glow = new THREE.Sprite(glowMat);
      glow.scale.set(9.5, 9.5, 1);
      nucleus.add(glow);
    }
    nucleus.add(label(centerLabel, "font-style:italic;font-size:18px;", -2.15).obj);

    // ── orbit paths: the category ring + each category's moon orbit ──
    const loop = (pts: THREE.Vector3[], mat: THREE.LineBasicMaterial) => {
      const geo = track(new THREE.BufferGeometry().setFromPoints(pts));
      scene.add(new THREE.LineLoop(geo, mat));
    };
    loop(Array.from({ length: 128 }, (_, j) => { const t = (j / 128) * Math.PI * 2; return new THREE.Vector3(Math.cos(t) * ORBIT_R, 0, Math.sin(t) * ORBIT_R); }), orbitMat);

    // ── planets + moons (BrainCanvas's atomic model) ──
    const planet = (R: number, position: THREE.Vector3, parent: THREE.Vector3 | null) => {
      const g = latLongGlobe(R, globeLineMat, (geo) => track(geo));
      const occ = new THREE.Mesh(track(new THREE.SphereGeometry(R * 0.965, 24, 24)), occluderMat);
      g.add(occ);
      g.position.copy(position);
      g.rotation.z = 0.2; // BrainOrb's quiet axial tilt
      scene.add(g);
      if (parent) loop([parent.clone(), position.clone()], spokeMat);
      return g;
    };

    categories.forEach((cat, i) => {
      const angle = (i / categories.length) * Math.PI * 2;
      const x = Math.cos(angle) * ORBIT_R;
      const z = Math.sin(angle) * ORBIT_R;
      const pos = new THREE.Vector3(x, 0, z);
      const node = planet(0.5, pos, nucleus.position);
      const { div, obj } = label(cat.label.toLowerCase(), "font-size:15px;", 0.85);
      node.add(obj);
      labelsRef.current.set(cat.key, div);
      const hit = document.createElement("div");
      hit.dataset.tap = `node-${cat.key}`;
      hit.style.cssText = "width:52px;height:52px;border-radius:50%;pointer-events:none;";
      node.add(new CSS2DObject(hit));

      const dirX = x / ORBIT_R, dirZ = z / ORBIT_R, perpX = -dirZ, perpZ = dirX;
      const moonAt = (t: number) => new THREE.Vector3(
        x + (Math.cos(t) * perpX + Math.sin(t) * dirX * 0.5) * SUB_ORBIT_R,
        Math.sin(t) * SUB_ORBIT_R * 0.7,
        z + (Math.cos(t) * perpZ + Math.sin(t) * dirZ * 0.5) * SUB_ORBIT_R,
      );
      loop(Array.from({ length: 64 }, (_, j) => moonAt((j / 64) * Math.PI * 2)), orbitMat);
      cat.children.forEach((child, j) => {
        const m = planet(0.34, moonAt((j / cat.children.length) * Math.PI * 2), pos);
        m.add(label(child.toLowerCase(), "font-size:11px;", 0.6).obj);
      });
    });

    // ── a few far stars ──
    if (dark) {
      const n = 160;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const r = 40 + Math.random() * 20, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        arr[i * 3] = r * Math.sin(ph) * Math.cos(th); arr[i * 3 + 1] = r * Math.cos(ph); arr[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      }
      const starGeo = track(new THREE.BufferGeometry());
      starGeo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      const starMat = track(new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.3, fog: false }));
      scene.add(new THREE.Points(starGeo, starMat));
    }

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
      div.style.fontSize = on ? "17px" : "15px";
      div.style.fontWeight = on ? "bold" : "normal";
    });
  }, [selected]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
