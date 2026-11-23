import type { Point } from '../domain/Model';
import type { ContactShape } from '../domain/SpriteContact';
import { DEFAULT_CAMERA_BASIS, type CameraBasis } from './VehicleSpriteBounds';

export interface MaskRect { left: number; bottom: number; right: number; top: number }
export interface ContactStyle {
    frame: { originalSize: { width: number; height: number }; rect: { width: number; height: number }; offset: { x: number; y: number } } | null;
    width: number; height: number; billboard: boolean; bottomAnchor: boolean;
    flipWithDirection: boolean; rotation: number; lift: number;
}
export function contactGeometry(style: ContactStyle, mask: MaskRect[], basis: CameraBasis, y: number,
    direction = 1, heading = 0, extraRotation = 0, scale = 1): ContactShape {
    const f = style.frame!;
    const width = Math.max(0.05, style.width), height = style.height || width * f.originalSize.height / f.originalSize.width;
    const camera = Math.abs(basis.forward.y) > 0.0001 ? basis : DEFAULT_CAMERA_BASIS;
    const right = style.billboard ? camera.right : { x: 1, y: 0, z: 0 };
    const up = style.billboard ? camera.up : { x: 0, y: 0, z: -1 };
    const angle = (style.rotation + extraRotation + (!style.billboard && style.flipWithDirection ? heading - 180 : 0)) * Math.PI / 180;
    const flip = style.billboard && style.flipWithDirection && direction < -0.01 ? -1 : 1;
    const sx = flip * width * f.rect.width / f.originalSize.width;
    const sy = height * f.rect.height / f.originalSize.height;
    const tx = flip * width * f.offset.x / f.originalSize.width;
    const ty = (style.bottomAnchor ? height / 2 : 0) + height * f.offset.y / f.originalSize.height;
    const project = (x: number, v: number): Point => {
        const px = scale * (tx + Math.cos(angle) * x * sx - Math.sin(angle) * v * sy);
        const py = scale * (ty + Math.sin(angle) * x * sx + Math.cos(angle) * v * sy);
        const wy = y - 0.1 + style.lift + right.y * px + up.y * py;
        return { x: right.x * px + up.x * py - wy * camera.forward.x / camera.forward.y,
            z: right.z * px + up.z * py - wy * camera.forward.z / camera.forward.y };
    };
    return { polygons: mask.map(r => [project(r.left, r.bottom), project(r.right, r.bottom), project(r.right, r.top), project(r.left, r.top)]) };
}

export function clipContactShape(shape: ContactShape, widthScale: number, heightScale: number): ContactShape {
    if (!shape.polygons.length) return shape;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const polygon of shape.polygons) for (const p of polygon) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    const insetX = (maxX - minX) * (1 - widthScale) / 2;
    const insetZ = (maxZ - minZ) * (1 - heightScale) / 2;
    const limits: Array<{ axis: 'x' | 'z'; limit: number; sign: number }> = [
        { axis: 'x', limit: minX + insetX, sign: 1 }, { axis: 'x', limit: maxX - insetX, sign: -1 },
        { axis: 'z', limit: minZ + insetZ, sign: 1 }, { axis: 'z', limit: maxZ - insetZ, sign: -1 },
    ];
    return { polygons: shape.polygons.map(source => {
        let polygon = source;
        for (const { axis, limit, sign } of limits) {
            const output: Point[] = [];
            for (let i = 0; i < polygon.length; i++) {
                const a = polygon[i], b = polygon[(i + 1) % polygon.length];
                const insideA = (a[axis] - limit) * sign >= 0, insideB = (b[axis] - limit) * sign >= 0;
                if (insideA) output.push(a);
                if (insideA !== insideB) {
                    const t = (limit - a[axis]) / (b[axis] - a[axis]);
                    output.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
                }
            }
            polygon = output;
        }
        return polygon;
    }).filter(polygon => polygon.length >= 3 && Math.abs(polygon.reduce((area, p, i) => {
        const next = polygon[(i + 1) % polygon.length];
        return area + p.x * next.z - next.x * p.z;
    }, 0)) > 1e-12) };
}

export function obstacleBodyShape(shape: ContactShape, direction: Point, fraction = 0.5): ContactShape {
    if (!shape.polygons.length || Math.hypot(direction.x, direction.z) < 1e-8 || fraction <= 0) return shape;
    const project = (p: Point) => p.x * direction.x + p.z * direction.z;
    let back = Infinity, front = -Infinity;
    for (const polygon of shape.polygons) for (const p of polygon) {
        const value = project(p);
        back = Math.min(back, value); front = Math.max(front, value);
    }
    const limit = front - (front - back) * Math.min(1, fraction);
    const polygons = shape.polygons.map(polygon => {
        const output: Point[] = [];
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i], b = polygon[(i + 1) % polygon.length];
            const da = project(a) - limit, db = project(b) - limit;
            if (da <= 0) output.push(a);
            if ((da <= 0) !== (db <= 0)) {
                const t = da / (da - db);
                output.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
            }
        }
        return output;
    }).filter(polygon => polygon.length >= 3 && Math.abs(polygon.reduce((area, p, i) => {
        const next = polygon[(i + 1) % polygon.length];
        return area + p.x * next.z - next.x * p.z;
    }, 0)) > 1e-12);
    return { polygons };
}

export function alphaRectangles(width: number, height: number, solid: (x: number, y: number) => boolean): MaskRect[] {
    const result: MaskRect[] = [];
    let previous = new Map<string, MaskRect>();
    for (let y = 0; y < height; y++) {
        const current = new Map<string, MaskRect>();
        for (let x = 0; x < width;) {
            if (!solid(x, y)) { x++; continue; }
            const start = x++;
            while (x < width && solid(x, y)) x++;
            const key = `${start}:${x}`;
            let rect = previous.get(key);
            if (rect) rect.bottom = 0.5 - (y + 1) / height;
            else {
                rect = { left: start / width - 0.5, right: x / width - 0.5, top: 0.5 - y / height, bottom: 0.5 - (y + 1) / height };
                result.push(rect);
            }
            current.set(key, rect);
        }
        previous = current;
    }
    return result;
}
