"use client";

import { useRef, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { isWebGLAvailable } from "@/lib/webgl";

const categories = [
  { label: "Personal", children: ["Gym", "Prayer", "Finances", "Schedule"] },
  { label: "Start-up", children: ["Product", "Team", "$$$"] },
  { label: "Work", children: ["QCP", "Training"] },
  { label: "School", children: ["Graduation"] },
];

interface BrainCanvasProps {
  zoomProgress?: number;
  hideTitle?: boolean;
  hideLabels?: boolean;
  heroMode?: boolean;
}

export default function BrainCanvas({ zoomProgress = 0, hideTitle = false, hideLabels = false, heroMode = false }: BrainCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    animationId: number;
    financesPosition: THREE.Vector3;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Bail gracefully when the browser can't do WebGL — otherwise creating the
    // renderer below throws and white-screens the whole page.
    if (!isWebGLAvailable()) return;
    const container = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    scene.fog = new THREE.FogExp2(0xffffff, 0.02);

    // Camera — heroMode brings it closer so the brain fills the viewport
    const isMobile = container.clientWidth < 768;
    const camera = new THREE.PerspectiveCamera(
      heroMode ? (isMobile ? 55 : 50) : 45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, heroMode ? 6 : 10, heroMode ? (isMobile ? 14 : 12) : 20);

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // CSS2D Renderer for labels
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0px";
    labelRenderer.domElement.style.pointerEvents = "none";
    labelRenderer.domElement.style.zIndex = "1";
    container.appendChild(labelRenderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableRotate = false;
    renderer.domElement.style.touchAction = "auto";

    // Create node helper
    let financesPosition = new THREE.Vector3();

    function createNode(
      type: "nucleus" | "category" | "item",
      labelText: string,
      position: THREE.Vector3,
      parentObj: THREE.Mesh | null
    ) {
      const isNucleus = type === "nucleus";
      const size = isNucleus ? 1.5 : 0.5;
      const geometry = new THREE.SphereGeometry(size, 32, 32);
      const material = new THREE.MeshBasicMaterial({
        color: isNucleus ? 0x000000 : 0xffffff,
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.copy(position);

      if (!isNucleus) {
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x000000 })
        );
        sphere.add(line);
      }

      // Label
      if (!hideLabels) {
        const div = document.createElement("div");
        div.textContent = labelText;
        div.style.cssText = `
          color: black;
          font-family: 'Playfair Display', serif;
          font-size: ${isNucleus ? "24px" : "14px"};
          font-weight: ${isNucleus ? "bold" : "normal"};
          text-shadow: 0 0 2px white;
          pointer-events: none;
          white-space: nowrap;
        `;
        const label = new CSS2DObject(div);
        label.position.set(0, isNucleus ? 1.8 : 0.8, 0);
        sphere.add(label);
      }

      scene.add(sphere);

      // Line to parent
      if (parentObj) {
        const points = [parentObj.position.clone(), position.clone()];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.2,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        scene.add(line);
      }

      // Track Finances node position
      if (labelText === "Finances") {
        financesPosition = position.clone();
      }

      return sphere;
    }

    // Build atomic model
    const nucleus = createNode(
      "nucleus",
      "You",
      new THREE.Vector3(0, 0, 0),
      null
    );

    const orbitRadius = 6;
    const subOrbitRadius = 2.5;

    categories.forEach((cat, i) => {
      const angle = (i / categories.length) * Math.PI * 2;
      const x = Math.cos(angle) * orbitRadius;
      const z = Math.sin(angle) * orbitRadius;

      const catNode = createNode(
        "category",
        cat.label,
        new THREE.Vector3(x, 0, z),
        nucleus
      );

      cat.children.forEach((childLabel, j) => {
        const subAngle = (j / cat.children.length) * Math.PI * 2;
        const dirX = x / orbitRadius;
        const dirZ = z / orbitRadius;
        const perpX = -dirZ;
        const perpZ = dirX;

        const sx =
          x +
          (Math.cos(subAngle) * perpX + Math.sin(subAngle) * dirX * 0.5) *
            subOrbitRadius;
        const sy = Math.sin(subAngle) * subOrbitRadius * 0.7;
        const sz =
          z +
          (Math.cos(subAngle) * perpZ + Math.sin(subAngle) * dirZ * 0.5) *
            subOrbitRadius;

        createNode("item", childLabel, new THREE.Vector3(sx, sy, sz), catNode);
      });
    });

    // Store refs
    sceneRef.current = {
      camera,
      controls,
      animationId: 0,
      financesPosition,
    };

    // Animation loop
    function animate() {
      if (sceneRef.current) {
        sceneRef.current.animationId = requestAnimationFrame(animate);
      }
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    }
    animate();

    // Resize
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      labelRenderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      if (container.contains(labelRenderer.domElement)) {
        container.removeChild(labelRenderer.domElement);
      }
    };
  }, [hideLabels, heroMode]);

  // Zoom camera towards Finances node based on scroll progress
  useEffect(() => {
    if (!sceneRef.current) return;
    const { camera, controls, financesPosition } = sceneRef.current;

    // Disable auto-rotate during zoom so it doesn't fight the camera
    if (zoomProgress > 0) {
      controls.autoRotate = false;
      controls.enabled = false;
    } else {
      controls.autoRotate = true;
      controls.enabled = true;
    }

    // Default position
    const defaultPos = new THREE.Vector3(0, 10, 20);
    // Zoom target: position camera close to Finances node, slightly offset
    const zoomTarget = new THREE.Vector3(
      financesPosition.x + 2,
      financesPosition.y + 1.5,
      financesPosition.z + 4
    );

    camera.position.lerpVectors(defaultPos, zoomTarget, zoomProgress);

    // Look at center when zoomed out, look at Finances node when zoomed in
    const lookTarget = new THREE.Vector3(
      financesPosition.x * zoomProgress,
      financesPosition.y * zoomProgress,
      financesPosition.z * zoomProgress
    );
    camera.lookAt(lookTarget);
    controls.target.copy(lookTarget);
  }, [zoomProgress]);

  return (
    <div className="w-full h-full bg-white relative">
      {/* Title overlay */}
      {!hideTitle && (
        <div className="absolute top-0 left-0 p-6 md:p-8 z-10 pointer-events-none">
          <h1
            className="text-3xl md:text-5xl text-black tracking-tight font-serif"
            style={{ letterSpacing: "-0.05em" }}
          >
            Your World
          </h1>
          <p className="text-black/40 italic mt-2 font-serif text-sm md:text-base">
            Your universe, mapped by Xyra.
          </p>
        </div>
      )}

      {/* Three.js canvas */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
