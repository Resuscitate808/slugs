import type { VehicleBounds, VehicleShapes } from '../domain/Model';

interface Vector { x: number; y: number; z: number }
interface FrameGeometry {
    originalSize: { width: number; height: number };
    rect: { width: number; height: number };
    offset: { x: number; y: number };
}
interface StyleGeometry {
    frame: FrameGeometry | null;
    width: number; height: number; rotation: number; lift: number;
    billboard: boolean; bottomAnchor: boolean; flipWithDirection: boolean;
}
export interface CameraBasis { right: Vector; up: Vector; forward: Vector }

const length = Math.hypot(25, 24);
export const DEFAULT_CAMERA_BASIS: CameraBasis = {
    right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 24 / length, z: -25 / length },
    forward: { x: 0, y: -25 / length, z: -24 / length },
};

export function vehicleSpriteShapes(style: StyleGeometry, basis = DEFAULT_CAMERA_BASIS): VehicleShapes | undefined {
    const f = style.frame;
    if (!f) return undefined;
    const width = Math.max(0.05, style.width);
    const height = style.height > 0 ? style.height : width * f.originalSize.height / Math.max(1, f.originalSize.width);
    if (![width, height, style.rotation, style.lift, f.originalSize.width, f.originalSize.height].every(Number.isFinite)
        || f.originalSize.width <= 0 || f.originalSize.height <= 0) return undefined;
    const camera = Math.abs(basis.forward.y) > 0.0001 ? basis : DEFAULT_CAMERA_BASIS;
    const right = style.billboard ? camera.right : { x: 1, y: 0, z: 0 };
    const up = style.billboard ? camera.up : { x: 0, y: 0, z: -1 };
    const make = (axis: 'x' | 'z', direction: number): VehicleBounds => {
        const heading = axis === 'x' ? direction * 90 : direction === 1 ? 0 : 180;
        const angle = (style.rotation + (style.billboard && axis === 'z' ? -90 : 0)
            + (!style.billboard && style.flipWithDirection ? heading - 180 : 0)) * Math.PI / 180;
        const flip = style.billboard && style.flipWithDirection && direction < 0 ? -1 : 1;
        const sx = flip * width * f.rect.width / f.originalSize.width;
        const sy = height * f.rect.height / f.originalSize.height;
        const tx = flip * width * f.offset.x / f.originalSize.width;
        const ty = (style.bottomAnchor ? height / 2 : 0) + height * f.offset.y / f.originalSize.height;
        const points: { x: number; z: number }[] = [];
        for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) {
            const px = tx + Math.cos(angle) * x * sx - Math.sin(angle) * y * sy;
            const py = ty + Math.sin(angle) * x * sx + Math.cos(angle) * y * sy;

            const worldY = 0.08 + style.lift + right.y * px + up.y * py;
            points.push({ x: right.x * px + up.x * py - worldY * camera.forward.x / camera.forward.y,
                z: right.z * px + up.z * py - worldY * camera.forward.z / camera.forward.y });
        }
        const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
        const minZ = Math.min(...points.map(p => p.z)), maxZ = Math.max(...points.map(p => p.z));
        return { halfX: Math.max(0.025, (maxX - minX) / 2), halfZ: Math.max(0.025, (maxZ - minZ) / 2),
            offsetX: (minX + maxX) / 2, offsetZ: (minZ + maxZ) / 2 };
    };
    return { xPositive: make('x', 1), xNegative: make('x', -1), zPositive: make('z', 1), zNegative: make('z', -1) };
}
