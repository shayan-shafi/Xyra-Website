"use client";

// ─── BrainWorld3D ────────────────────────────────────────────────────────────
// The app's world (xyrav2-org/web BrainGraph3D), on the site: same scene and
// camera, the same layout (brainLayout.ts, copied whole), the same node kinds
// (the center, life areas, boards, memory shelves, a split shelf's pages), the
// same ink-on-paper globes and spokes, labels that never pile up, a spin that
// waits while you aim, and the same tap: the label goes bold, the camera
// glides onto the node, its file opens beside it.
//
// What the site changes: the world is drawn from heroWorld.ts instead of a
// signed-in person's rows; the canvas is clear so the page's paper and grid
// show through; the wheel and a touch drag scroll the page instead of the
// world; the world can sit lower in its box (`lift`) to leave room for a
// headline; and until someone touches it, it opens a few nodes on its own.

import { MutableRefObject, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { isWebGLAvailable } from "@/lib/webgl";
import { layoutWorld, titleCase, NODE_SIZE } from "./brainLayout";
import { WORLD, selId, type Selection } from "./heroWorld";

export type WorldApi = {
  select: (s: Selection) => boolean;
  deselect: () => void;
  /** someone took over: the world stops opening nodes on its own */
  stopTour: () => void;
};

type Kind = "nucleus" | "category" | "item" | "area" | "sub";
type NodeRec = { mesh: THREE.Mesh; label: HTMLDivElement; labelObj: CSS2DObject; sel: Selection; kind: Kind; parent: NodeRec | null };

const PAPER = "#fbfaf8";
const INK = "#000000";
const LABEL_RANK: Record<Kind, number> = { nucleus: 0, category: 1, item: 2, area: 3, sub: 4 };
const REST_OPACITY: Record<Kind, number> = { nucleus: 1, category: 1, item: 1, area: 0.8, sub: 0.6 };
const HIT_SCALE = 1.8;
const SPIN_HOLD_MS = 2000;
const GLIDE_MS = 1000;
const FOCUS_FOG = 0.035;
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// What the world opens by itself, in order, until someone touches it.
const TOUR: Selection[] = [
  { kind: "area", key: "work" },
  { kind: "moon", key: "health", id: "routines" },
  { kind: "moon", key: "goals", id: "bench" },
  { kind: "moon", key: "social", id: "family" },
];
const TOUR_FIRST_MS = 6500;
const TOUR_HOLD_MS = 7000;
const TOUR_REST_MS = 5000;

export default function BrainWorld3D({
  apiRef,
  onSelect,
  sheet = false,
  lift = 0,
  tour = true,
}: {
  apiRef: MutableRefObject<WorldApi | null>;
  onSelect: (s: Selection | null) => void;
  /** narrow screens: the file is a sheet over the bottom half, so a picked node settles high and centered */
  sheet?: boolean;
  /** how far below the box's middle the world's center sits, as a share of its height */
  lift?: number;
  tour?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;
  const liftRef = useRef(lift);
  liftRef.current = lift;
  const refitRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isWebGLAvailable()) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;

    const ink = new THREE.Color(INK);
    const paper = new THREE.Color(PAPER);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(paper.getHex(), 0.02);
    const nucleusMat = new THREE.MeshBasicMaterial({ color: ink });
    const moonMat = new THREE.MeshBasicMaterial({ color: paper });
    const outlineMat = new THREE.LineBasicMaterial({ color: ink });
    const areaOutlineMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.55 });
    const spokeMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.2 });
    const areaSpokeMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.12 });
    const hitMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const disposables: { dispose: () => void }[] = [nucleusMat, moonMat, outlineMat, areaOutlineMat, spokeMat, areaSpokeMat, hitMat];

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 1000);
    camera.position.set(0, 10, 20);
    const HOME_LEN = camera.position.length();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
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
    controls.autoRotate = !still;
    controls.autoRotateSpeed = 0.5;
    // the page owns the wheel and a touch drag; a mouse drag still turns the world
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableRotate = finePointer;
    // a drag turns it and tips it a little, never onto its edge or its pole
    controls.minPolarAngle = 0.75;
    controls.maxPolarAngle = 1.3;
    renderer.domElement.style.touchAction = "pan-y";

    const nodes: NodeRec[] = [];
    const meshes: THREE.Mesh[] = [];
    let hovered: NodeRec | null = null;
    let spinHeldUntil = 0;
    const holdSpin = () => { spinHeldUntil = performance.now() + SPIN_HOLD_MS; };
    const labelSize = new Map<HTMLDivElement, { w: number; h: number }>();

    function createNode(kind: Kind, labelText: string, position: THREE.Vector3, parent: NodeRec | null, sel: Selection) {
      const parentObj = parent?.mesh ?? null;
      const isNucleus = kind === "nucleus";
      const size = NODE_SIZE[kind];
      const geometry = new THREE.SphereGeometry(size, 32, 32);
      disposables.push(geometry);
      const sphere = new THREE.Mesh(geometry, isNucleus ? nucleusMat : moonMat);
      sphere.position.copy(position);

      if (!isNucleus) {
        const edges = new THREE.EdgesGeometry(geometry);
        disposables.push(edges);
        sphere.add(new THREE.LineSegments(edges, kind === "area" || kind === "sub" ? areaOutlineMat : outlineMat));
      }

      const div = document.createElement("div");
      div.textContent = kind === "area" || kind === "sub" ? titleCase(labelText) : labelText;
      div.style.cssText = `
        color: ${INK};
        font-family: var(--font-playfair), 'Playfair Display', serif;
        font-size: ${isNucleus ? "24px" : kind === "sub" ? "10px" : kind === "area" ? "12px" : "14px"};
        font-weight: ${isNucleus ? "bold" : "normal"};
        opacity: ${REST_OPACITY[kind]};
        text-shadow: 0 0 2px ${PAPER}, 0 0 6px ${PAPER};
        pointer-events: auto;
        cursor: pointer;
        white-space: nowrap;
        user-select: none;
        transition: font-size 0.25s ease, font-weight 0.25s ease, opacity 0.45s ease;
      `;
      const label = new CSS2DObject(div);
      label.position.set(0, isNucleus ? 1.8 : kind === "sub" ? 0.38 : kind === "area" ? 0.7 : 0.8, 0);
      sphere.add(label);
      scene.add(sphere);

      const hitGeo = new THREE.SphereGeometry(isNucleus ? size : size * HIT_SCALE, 12, 12);
      disposables.push(hitGeo);
      const hit = new THREE.Mesh(hitGeo, hitMat);
      sphere.add(hit);

      if (parentObj) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([parentObj.position.clone(), position.clone()]);
        disposables.push(lineGeo);
        scene.add(new THREE.Line(lineGeo, kind === "area" || kind === "sub" ? areaSpokeMat : spokeMat));
      }

      hit.userData.nodeIndex = nodes.length;
      const rec: NodeRec = { mesh: sphere, label: div, labelObj: label, sel, kind, parent };
      div.addEventListener("click", () => { if (rec !== current) select(rec); });
      div.addEventListener("pointerenter", () => { hovered = rec; });
      div.addEventListener("pointerleave", () => { if (hovered === rec) hovered = null; holdSpin(); });
      nodes.push(rec);
      meshes.push(hit);
      return rec;
    }

    // Build the atom
    const nucleus = createNode("nucleus", "you", new THREE.Vector3(0, 0, 0), null, { kind: "you" });
    const placed = layoutWorld({
      categories: WORLD.map((area) => ({
        moons: area.moons.map((m) => (m.kind === "shelf" ? { size: NODE_SIZE.area, pages: m.pages?.length ?? 0 } : { size: NODE_SIZE.item, pages: 0 })),
      })),
    });
    const v = (p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x, p.y, p.z);
    WORLD.forEach((area, i) => {
      const spot = placed.categories[i];
      const catNode = createNode("category", area.label, v(spot.at), nucleus, { kind: "area", key: area.key });
      area.moons.forEach((m, j) => {
        const moon = spot.moons[j];
        const sel: Selection = { kind: "moon", key: area.key, id: m.id };
        if (m.kind === "shelf") {
          const shelf = createNode("area", m.title, v(moon.at), catNode, sel);
          (m.pages ?? []).forEach((p, k) => {
            createNode("sub", p.title, v(moon.pages[k]), shelf, { kind: "page", key: area.key, id: m.id, page: p.id });
          });
        } else {
          createNode("item", m.title, v(moon.at), catNode, sel);
        }
      });
    });

    // ── selection + the camera glide ────────────────────────────────────
    type Pose = { position: THREE.Vector3; target: THREE.Vector3 };
    let glide: { from: THREE.Vector3; to: THREE.Vector3; lookFrom: THREE.Vector3; lookTo: THREE.Vector3; start: number; ms: number; home?: Pose; onDone?: () => void } | null = null;
    // The camera travels round the world, never through it: angle, distance
    // from the axis and height each ease on their own, the short way round.
    const turn = (from: THREE.Vector3, to: THREE.Vector3) => {
      let d = Math.atan2(to.z, to.x) - Math.atan2(from.z, from.x);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      return d;
    };
    const swing = (from: THREE.Vector3, to: THREE.Vector3, e: number) => {
      const a = Math.atan2(from.z, from.x) + turn(from, to) * e;
      const r = Math.hypot(from.x, from.z) + (Math.hypot(to.x, to.z) - Math.hypot(from.x, from.z)) * e;
      camera.position.set(Math.cos(a) * r, from.y + (to.y - from.y) * e, Math.sin(a) * r);
    };
    // a longer way round takes a little longer
    const glideMs = (from: THREE.Vector3, to: THREE.Vector3) => GLIDE_MS + 700 * (Math.abs(turn(from, to)) / Math.PI);
    let savedPose: Pose | null = null;
    let current: NodeRec | null = null;
    const look = new THREE.Vector3();
    const currentLook = () => (glide ? look.clone() : controls.target.clone());

    const settleControls = () => {
      controls.autoRotate = false;
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = damping;
    };

    const styleLabel = (rec: NodeRec, on: boolean) => {
      labelSize.delete(rec.label);
      if (rec.kind === "nucleus") return;
      const [off, onSize] = rec.kind === "sub" ? ["10px", "12px"] : rec.kind === "area" ? ["12px", "14px"] : ["14px", "16px"];
      rec.label.style.fontSize = on ? onSize : off;
      rec.label.style.fontWeight = on ? "bold" : "normal";
    };

    // With a node open, the rest of the world steps back: only the node, what
    // it hangs from, what hangs from it and its neighbours on the same ring
    // keep their ink; the fog closes in behind them.
    const near = (rec: NodeRec, open: NodeRec) => {
      if (open.kind === "nucleus") return rec.kind === "nucleus" || rec.kind === "category";
      for (let p: NodeRec | null = open; p; p = p.parent) if (p === rec) return true;
      for (let p: NodeRec | null = rec.parent; p; p = p.parent) if (p === open) return true;
      return rec.parent !== null && rec.parent.kind !== "nucleus" && rec.parent === open.parent;
    };
    const focus = (open: NodeRec | null) => {
      for (const rec of nodes) {
        const on = rec === open;
        rec.label.style.opacity = String(on ? 1 : !open || near(rec, open) ? REST_OPACITY[rec.kind] : 0.16);
      }
    };

    // On a narrow box the camera backs off, but only so far: on a phone the
    // areas stay in frame and the outer moons run off the sides (the world
    // turns, so each comes round), instead of the whole thing shrinking to dots.
    const fitScale = () => Math.min(1.55, Math.max(1.08, 1.6 / camera.aspect));

    const select = (rec: NodeRec) => {
      if (current) styleLabel(current, false);
      current = rec;
      styleLabel(rec, true);
      focus(rec);
      onSelectRef.current(rec.sel);
      if (controls.enabled) settleControls();
      controls.enabled = false;
      if (!savedPose) savedPose = glide?.home ?? { position: camera.position.clone(), target: controls.target.clone() };
      const node = rec.mesh.position.clone();
      // The app comes at a node from whichever side the camera is on. Here
      // the camera swings round to the node's own side of the world and looks
      // back in over it: the node in front, the center behind, the rest in fog.
      const dir = node.clone().setY(0);
      if (dir.lengthSq() < 1e-6) dir.copy(camera.position).setY(0);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      dir.normalize();
      // Further back and higher than the app stands: close to the angle the
      // resting world is seen from, so a picked node still reads as a map.
      const narrow = sheetRef.current;
      const k = narrow ? fitScale() : 1;
      const dist = (rec.kind === "nucleus" ? 15 : rec.kind === "category" ? 11 : rec.kind === "sub" ? 7 : 9.5) * k;
      const up = dist * (rec.kind === "nucleus" ? 0.45 : 0.6);
      // Where the node should come to rest, in the box's own -1..1: wide, in
      // the middle of the room left of the file card and under the headline;
      // narrow, centered in the strip between the headline and the sheet.
      // The camera looks at a point beside the node to put it there.
      const w = container.clientWidth;
      const cardShare = narrow ? 0 : (Math.min(440, w * 0.4) + 24) / w;
      const wantX = -cardShare;
      const wantY = narrow ? 0.16 : -0.3;
      const halfH = Math.hypot(dist, up) * Math.tan((camera.fov * Math.PI) / 360);
      const halfW = halfH * camera.aspect;
      const right = new THREE.Vector3(dir.z, 0, -dir.x);
      const target = node.clone().addScaledVector(right, -wantX * halfW);
      const to = target.clone().addScaledVector(dir, dist).add(new THREE.Vector3(0, up, 0));
      const settled = target.clone().add(new THREE.Vector3(0, -(wantY + 2 * liftRef.current) * halfH, 0));
      glide = { from: camera.position.clone(), to, lookFrom: currentLook(), lookTo: settled, start: performance.now(), ms: glideMs(camera.position, to),
        onDone: () => { controls.target.copy(settled); camera.lookAt(settled); controls.enabled = true; } };
    };

    const deselect = () => {
      if (!current && !savedPose) return;
      if (current) styleLabel(current, false);
      current = null;
      focus(null);
      onSelectRef.current(null);
      const pose = savedPose;
      savedPose = null;
      if (!pose) { controls.autoRotate = !still; controls.enabled = true; return; }
      // Home is the resting height and distance, on the side the camera is on
      // now: it backs out and up, it doesn't swing back to where it started.
      const at = Math.atan2(camera.position.z, camera.position.x);
      const homeR = Math.hypot(pose.position.x, pose.position.z);
      pose.position.set(Math.cos(at) * homeR, pose.position.y, Math.sin(at) * homeR);
      if (controls.enabled) settleControls();
      controls.enabled = false;
      glide = { from: camera.position.clone(), to: pose.position, lookFrom: currentLook(), lookTo: pose.target, start: performance.now(), ms: glideMs(camera.position, pose.position), home: pose,
        onDone: () => { controls.target.copy(pose.target); camera.lookAt(pose.target); controls.enabled = true; controls.autoRotate = !still; } };
    };

    // ── the tour: a few nodes open on their own until someone takes over ──
    let touring = tour && !still;
    let tourAt = performance.now() + TOUR_FIRST_MS;
    let tourLast = -1;
    let tourPick = -1;
    let tourOpen = false;
    const stopTour = () => { touring = false; };
    const runTour = (now: number) => {
      if (!touring || now < tourAt || glide) return;
      if (tourOpen) {
        tourOpen = false;
        deselect();
        tourAt = now + TOUR_REST_MS;
        return;
      }
      // the stop that faces the camera right now, never the one just shown
      let rec: NodeRec | null = null;
      let best = -Infinity;
      const facing = camera.position.clone().setY(0).normalize();
      TOUR.forEach((stop, i) => {
        if (i === tourLast) return;
        const n = nodes.find((x) => selId(x.sel) === selId(stop));
        if (!n) return;
        const d = n.mesh.position.clone().setY(0).normalize().dot(facing);
        if (d > best) { best = d; rec = n; tourPick = i; }
      });
      if (!rec) return;
      tourLast = tourPick;
      select(rec);
      tourOpen = true;
      tourAt = now + TOUR_HOLD_MS;
    };

    apiRef.current = {
      select: (s) => { const rec = nodes.find((n) => selId(n.sel) === selId(s)); if (rec && rec !== current) select(rec); return !!rec; },
      deselect,
      stopTour,
    };

    // A click is a pointer that didn't travel; a drag stays an orbit.
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { stopTour(); down = { x: e.clientX, y: e.clientY }; };
    const pick = (e: PointerEvent): NodeRec | null => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      return hit ? nodes[(hit.object as THREE.Mesh).userData.nodeIndex as number] ?? null : null;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      holdSpin();
      hovered = pick(e);
      renderer.domElement.style.cursor = hovered ? "pointer" : "grab";
    };
    const onLeave = () => { hovered = null; holdSpin(); };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 6) return;
      const rec = pick(e);
      if (rec) {
        if (rec !== current) select(rec);
      } else if (current) {
        deselect();
      }
    };
    const onCancel = () => { down = null; };
    const el = renderer.domElement;
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.style.cursor = finePointer ? "grab" : "default";

    // Labels never pile up: project every label and keep the higher-ranked
    // one wherever two would overlap (selected and hovered first).
    const labelAt = new THREE.Vector3();
    const kept: Array<{ x0: number; x1: number; y0: number; y1: number }> = [];
    const cullLabels = () => {
      const w = container.clientWidth, h = container.clientHeight;
      const order = nodes.map((rec) => ({ rec, rank: rec === current || rec === hovered ? -1 : LABEL_RANK[rec.kind] }))
        .sort((a, b) => a.rank - b.rank);
      kept.length = 0;
      for (const { rec } of order) {
        if (rec.label.style.display === "none") continue;
        let size = labelSize.get(rec.label);
        if (!size) { size = { w: rec.label.offsetWidth, h: rec.label.offsetHeight }; labelSize.set(rec.label, size); }
        rec.labelObj.getWorldPosition(labelAt).project(camera);
        const x = (labelAt.x * 0.5 + 0.5) * w, y = (-labelAt.y * 0.5 + 0.5) * h;
        const box = { x0: x - size.w / 2 - 3, x1: x + size.w / 2 + 3, y0: y - size.h / 2 - 1, y1: y + size.h / 2 + 1 };
        const clash = kept.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0);
        rec.label.style.visibility = clash ? "hidden" : "";
        if (!clash) kept.push(box);
      }
    };

    let restFog = 0.02;

    // Only draw while the world is on screen.
    let onScreen = true;
    const seen = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) tourAt = Math.max(tourAt, performance.now() + 1500);
    }, { threshold: 0.05 });
    seen.observe(container);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (!onScreen) return;
      const now = performance.now();
      runTour(now);
      if (glide) {
        const e = easeInOutCubic(Math.min(1, (now - glide.start) / glide.ms));
        swing(glide.from, glide.to, e);
        look.lerpVectors(glide.lookFrom, glide.lookTo, e);
        camera.lookAt(look);
        if (e >= 1) { const done = glide.onDone; glide = null; done?.(); }
      } else {
        controls.autoRotate = !still && !current && !(hovered && hovered.kind !== "nucleus") && now > spinHeldUntil;
        controls.update();
      }
      const fog = scene.fog as THREE.FogExp2;
      fog.density += ((current ? FOCUS_FOG : restFog) - fog.density) * 0.08;
      labelRenderer.render(scene, camera);
      cullLabels();
      renderer.render(scene, camera);
    };

    // The world's box changes with the page, not only the window. Home sits
    // further back on a narrow box, and the whole picture drops by `lift`.
    const handleResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      const drop = Math.round(h * liftRef.current);
      if (drop) camera.setViewOffset(w, h, 0, -drop, w, h);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
      const k = fitScale();
      restFog = 0.02 / k;
      const home = savedPose?.position ?? (glide?.home ? glide.home.position : !glide && !current ? camera.position : null);
      if (home) home.setLength(HOME_LEN * k);
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
      labelSize.clear();
    };
    refitRef.current = handleResize;
    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    animate();

    return () => {
      seen.disconnect();
      resizeObserver.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
      apiRef.current = null;
      refitRef.current = null;
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      if (container.contains(labelRenderer.domElement)) container.removeChild(labelRenderer.domElement);
    };
  }, [apiRef, tour]);

  useEffect(() => { refitRef.current?.(); }, [lift]);

  // The world thins out to nothing under the headline, so a globe that drifts
  // up there in a close-up never sits on the wordmark or the buttons.
  const fade = "linear-gradient(to bottom, transparent 150px, #000 300px)";
  return <div ref={containerRef} className="absolute inset-0" style={{ maskImage: fade, WebkitMaskImage: fade }} />;
}
