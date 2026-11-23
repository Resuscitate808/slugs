import type { Point } from './Model';

export type Polygon = Point[];
export interface ContactShape { polygons: Polygon[] }
interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number }
interface Branch extends Bounds { left?: Branch; right?: Branch; polygons?: Polygon[] }
const polygonBounds = new WeakMap<Polygon, Bounds>();
const trees = new WeakMap<ContactShape, Branch>();
function emptyBounds(): Bounds { return { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }; }
function include(b: Bounds, p: Bounds): void {
    b.minX = Math.min(b.minX, p.minX); b.maxX = Math.max(b.maxX, p.maxX);
    b.minZ = Math.min(b.minZ, p.minZ); b.maxZ = Math.max(b.maxZ, p.maxZ);
}
function bounds(p: Polygon): Bounds {
    let b = polygonBounds.get(p);
    if (!b) {
        b = emptyBounds();
        for (const v of p) {
            b.minX = Math.min(b.minX, v.x); b.maxX = Math.max(b.maxX, v.x);
            b.minZ = Math.min(b.minZ, v.z); b.maxZ = Math.max(b.maxZ, v.z);
        }
        polygonBounds.set(p, b);
    }
    return b;
}
function build(polygons: Polygon[]): Branch {
    const branch: Branch = emptyBounds();
    for (const p of polygons) include(branch, bounds(p));
    if (polygons.length <= 4) branch.polygons = polygons;
    else {
        const x = branch.maxX - branch.minX >= branch.maxZ - branch.minZ;
        polygons.sort((a, b) => {
            const aa = bounds(a), bb = bounds(b);
            return x ? aa.minX + aa.maxX - bb.minX - bb.maxX : aa.minZ + aa.maxZ - bb.minZ - bb.maxZ;
        });
        const half = polygons.length >> 1;
        branch.left = build(polygons.slice(0, half));
        branch.right = build(polygons.slice(half));
    }
    return branch;
}
function tree(shape: ContactShape): Branch {
    let root = trees.get(shape);
    if (!root) { root = build(shape.polygons.slice()); trees.set(shape, root); }
    return root;
}
export function shapeBounds(shape: ContactShape): Readonly<Bounds> { return tree(shape); }
function overlaps(a: Bounds, b: Bounds, from: Point, at: Point, dx: number, dz: number): boolean {
    return a.maxX + from.x + Math.max(0, dx) >= b.minX + at.x
        && a.minX + from.x + Math.min(0, dx) <= b.maxX + at.x
        && a.maxZ + from.z + Math.max(0, dz) >= b.minZ + at.z
        && a.minZ + from.z + Math.min(0, dz) <= b.maxZ + at.z;
}
function polygonEntry(pa: Polygon, pb: Polygon, from: Point, at: Point, dx: number, dz: number): number | undefined {
    let enter = 0, leave = 1;
    for (let side = 0; side < 2; side++) {
        const polygon = side === 0 ? pa : pb;
        for (let i = 0; i < polygon.length; i++) {
            const p = polygon[i], q = polygon[(i + 1) % polygon.length];
            const nx = -(q.z - p.z), nz = q.x - p.x;
            let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
            for (const v of pa) {
                const value = (v.x + from.x) * nx + (v.z + from.z) * nz;
                amin = Math.min(amin, value); amax = Math.max(amax, value);
            }
            for (const v of pb) {
                const value = (v.x + at.x) * nx + (v.z + at.z) * nz;
                bmin = Math.min(bmin, value); bmax = Math.max(bmax, value);
            }
            const speed = dx * nx + dz * nz;
            if (Math.abs(speed) < 1e-12) {
                if (amax <= bmin || bmax <= amin) return undefined;
            } else {
                const t1 = (bmin - amax) / speed, t2 = (bmax - amin) / speed;
                enter = Math.max(enter, Math.min(t1, t2)); leave = Math.min(leave, Math.max(t1, t2));
                if (enter > leave) return undefined;
            }
        }
    }
    return leave >= enter && leave >= 0 && enter <= 1 ? enter : undefined;
}
function visit(a: Branch, b: Branch, from: Point, at: Point, dx: number, dz: number, first: number): number {
    if (first === 0 || !overlaps(a, b, from, at, dx, dz)) return first;
    if (a.polygons && b.polygons) {
        for (const pa of a.polygons) for (const pb of b.polygons) {
            if (!overlaps(bounds(pa), bounds(pb), from, at, dx, dz)) continue;
            const hit = polygonEntry(pa, pb, from, at, dx, dz);
            if (hit !== undefined && hit < first) first = hit;
            if (first === 0) return 0;
        }
    } else if (a.polygons || (!b.polygons && (b.maxX - b.minX + b.maxZ - b.minZ > a.maxX - a.minX + a.maxZ - a.minZ))) {
        first = visit(a, b.left!, from, at, dx, dz, first);
        first = visit(a, b.right!, from, at, dx, dz, first);
    } else {
        first = visit(a.left!, b, from, at, dx, dz, first);
        first = visit(a.right!, b, from, at, dx, dz, first);
    }
    return first;
}
export function shapeEntry(a: ContactShape, from: Point, to: Point, b: ContactShape, at: Point): number | undefined {
    if (!a.polygons.length || !b.polygons.length) return undefined;
    const first = visit(tree(a), tree(b), from, at, to.x - from.x, to.z - from.z, Infinity);
    return first === Infinity ? undefined : first;
}

export function shapeFront(shape: ContactShape, axis: 'x' | 'z', cross: 'x' | 'z', direction: number,
    min: number, max: number): number | undefined {
    let front: number | undefined;
    const include = (value: number): void => {
        if (front === undefined || (direction > 0 ? value > front : value < front)) front = value;
    };
    for (const polygon of shape.polygons) {
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i], b = polygon[(i + 1) % polygon.length];
            if (a[cross] >= min && a[cross] <= max) include(a[axis]);
            for (const limit of [min, max]) {
                const da = a[cross] - limit, db = b[cross] - limit;
                if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
                    include(a[axis] + (b[axis] - a[axis]) * da / (da - db));
                }
            }
        }
    }
    return front;
}
