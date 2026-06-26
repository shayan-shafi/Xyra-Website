/**
 * Detects whether the browser can actually create a WebGL context.
 *
 * Some browsers (e.g. Chrome with hardware acceleration disabled, blocklisted
 * GPUs, or remote/VM sessions) expose Three.js but fail when a real WebGL
 * context is requested. Instantiating THREE.WebGLRenderer in that case throws,
 * which — when it happens inside a useEffect — unmounts the React tree and
 * leaves the visitor staring at a white screen. Guard with this first.
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}
