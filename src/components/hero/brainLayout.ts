// Where every node of the world sits (BrainGraph3D draws them). Pure, so it
// can be tested without a scene.
//
// The user is the centre; the life areas sit on a ring around them; each
// area's shelves and boards fan out on a tilted ring past it, sized to how
// many there are; a split shelf's pages ring it closely. Then a few passes
// push apart anything closer than its size plus room for a label (2026-10-21:
// "allergies" sat inside "loose thoughts", a shelf inside a board), moving
// only moons: the centre and the areas stay where they are.

export type Vec = { x: number; y: number; z: number };

export interface LayoutInput {
  /** Per life area, its moons in order; each moon says how many pages ring it. */
  categories: { moons: { size: number; pages: number }[] }[];
}

export interface LayoutOutput {
  categories: { at: Vec; moons: { at: Vec; pages: Vec[] }[] }[];
}

export const NODE_SIZE = { nucleus: 1.5, category: 0.5, item: 0.5, area: 0.4, sub: 0.2 } as const;
export const ORBIT_R = 6;
const MOON_GAP = 1.35;           // arc length one moon needs on its area's ring
const MIN_MOON_R = 2.0;
const PAGE_ORBIT_R = 0.95;
const LABEL_ROOM = 0.55;         // kept clear between two spheres, for their labels
const PASSES = 120;

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const len = (a: Vec) => Math.hypot(a.x, a.y, a.z);

export function layoutWorld(input: LayoutInput): LayoutOutput {
  type Body = { at: Vec; r: number; fixed: boolean };
  const bodies: Body[] = [{ at: { x: 0, y: 0, z: 0 }, r: NODE_SIZE.nucleus, fixed: true }];
  const n = input.categories.length;

  const shape = input.categories.map((cat, i) => {
    const angle = (i / Math.max(1, n)) * Math.PI * 2;
    const out: Vec = { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
    const perp: Vec = { x: -out.z, y: 0, z: out.x };
    const at = scale(out, ORBIT_R);
    const catBody = bodies.push({ at, r: NODE_SIZE.category, fixed: true }) - 1;

    // Tilted between "up" and "outward", so the fan has depth from any side
    // and its inner edge stays past the area, never back toward the centre.
    const tilt = add(scale({ x: 0, y: 1, z: 0 }, 0.6), scale(out, 0.8));
    const m = cat.moons.length;
    const R = Math.max(MIN_MOON_R, (m * MOON_GAP) / (2 * Math.PI));
    const centre = add(at, scale(out, R * 0.9));
    const moons = cat.moons.map((moon, j) => {
      const t = (j / Math.max(1, m)) * Math.PI * 2;
      const pos = add(centre, add(scale(perp, Math.cos(t) * R), scale(tilt, Math.sin(t) * R)));
      const moonBody = bodies.push({ at: pos, r: moon.size, fixed: false }) - 1;
      const pages = Array.from({ length: moon.pages }, (_, k) => {
        const a = (k / moon.pages) * Math.PI * 2 + t;
        const off = scale({ x: Math.cos(a), y: Math.sin(a) * 0.55, z: Math.sin(a) }, PAGE_ORBIT_R);
        return bodies.push({ at: add(pos, off), r: NODE_SIZE.sub, fixed: false }) - 1;
      });
      return { moonBody, pages };
    });
    return { catBody, moons };
  });

  relax(bodies);

  return {
    categories: shape.map((c) => ({
      at: bodies[c.catBody].at,
      moons: c.moons.map((mo) => ({ at: bodies[mo.moonBody].at, pages: mo.pages.map((p) => bodies[p].at) })),
    })),
  };
}

/** Push apart every pair closer than their radii plus LABEL_ROOM; fixed bodies never move. */
export function relax(bodies: { at: Vec; r: number; fixed: boolean }[], passes = PASSES): void {
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        if (a.fixed && b.fixed) continue;
        const want = a.r + b.r + LABEL_ROOM;
        let d = { x: b.at.x - a.at.x, y: b.at.y - a.at.y, z: b.at.z - a.at.z };
        let dist = len(d);
        if (dist >= want) continue;
        // Two bodies in the same spot: part them along a fixed, index-based direction.
        if (dist < 1e-6) { d = { x: Math.cos(i + j), y: 0.3, z: Math.sin(i + j) }; dist = len(d); }
        const push = scale(d, (want - dist) / dist);
        if (a.fixed) b.at = add(b.at, push);
        else if (b.fixed) a.at = add(a.at, scale(push, -1));
        else { a.at = add(a.at, scale(push, -0.5)); b.at = add(b.at, scale(push, 0.5)); }
        moved = true;
      }
    }
    if (!moved) return;
  }
}

/** Shelf names as the world shows them: "loose thoughts" → "Loose Thoughts". */
export const titleCase = (s: string) => s.replace(/\b([a-z])/g, (c) => c.toUpperCase());
