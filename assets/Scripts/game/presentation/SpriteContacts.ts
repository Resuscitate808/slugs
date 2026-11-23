import { Camera, SpriteFrame, Texture2D, Vec3 } from 'cc';
import type { Point, Vehicle, Zombie } from '../domain/Model';
import type { World, SpriteContacts as Contacts } from '../domain/World';
import { shapeBounds, shapeEntry, shapeFront, type ContactShape } from '../domain/SpriteContact';
import { OBSTACLE_CONTACT_SCALE, segmentHitsCircle } from '../domain/ObstacleSystem';
import { VEHICLE_CONTACT_HEIGHT_SCALE } from '../domain/VehicleContact';
import type { SpriteStyle } from './SpriteStyle';
import { alphaRectangles, clipContactShape, contactGeometry, obstacleBodyShape, type MaskRect } from './SpriteContactGeometry';
import type { CameraBasis } from './VehicleSpriteBounds';
import { GameSettings } from './GameSettings';

export class SpriteContacts implements Contacts {
    private masks = new Map<SpriteFrame, Map<number, MaskRect[]>>();
    private shapes = new Map<string, ContactShape>();
    private maskFailures = new Map<SpriteFrame, number>();
    private obstacleBodies = new WeakMap<Zombie, { source: ContactShape; x: number; z: number; body: ContactShape }>();
    private basis: CameraBasis;
    constructor(private world: World, private settings: GameSettings, camera: Camera,
        private zombieStyle: (z: Zombie) => SpriteStyle | null) {
        const rotation = camera.node.worldRotation;
        this.basis = {
            right: Vec3.transformQuat(new Vec3(), new Vec3(1, 0, 0), rotation),
            up: Vec3.transformQuat(new Vec3(), new Vec3(0, 1, 0), rotation),
            forward: Vec3.transformQuat(new Vec3(), new Vec3(0, 0, -1), rotation),
        };
    }
    private mask(frame: SpriteFrame, threshold = 0.5): MaskRect[] {
        const alpha = Math.ceil(Math.max(0.01, Math.min(1, Number.isFinite(threshold) ? threshold : 0.5)) * 255);
        const cached = this.masks.get(frame)?.get(alpha);
        if (cached) return cached;
        const failedAt = this.maskFailures.get(frame);
        const fallback = [{ left: -0.5, bottom: -0.5, right: 0.5, top: 0.5 }];
        if (failedAt !== undefined && Date.now() - failedAt < 1000) return fallback;
        let result: MaskRect[];
        try {
            const packed = frame.original;
            const texture = (packed?._texture ?? frame.texture) as Texture2D;
            const image = texture.image;
            if (!image) throw new Error('Sprite texture image unavailable');
            const source = image.data;
            const canvas = { width: texture.width, height: texture.height };
            const atlas = { width: frame.texture.width, height: frame.texture.height };
            const shiftX = packed ? frame.rect.x - packed._x : 0, shiftY = packed ? frame.rect.y - packed._y : 0;
            let pixels: Uint8Array | Uint8ClampedArray;
            if (source instanceof Uint8Array || source instanceof Uint8ClampedArray) {
                if (source.byteLength !== canvas.width * canvas.height * 4) throw new Error('Sprite texture is not readable RGBA8');
                pixels = source;
            } else {
                const surface = document.createElement('canvas');
                surface.width = canvas.width; surface.height = canvas.height;
                const context = surface.getContext('2d', { willReadFrequently: true });
                if (!context) throw new Error('Canvas 2D unavailable');
                context.drawImage(source as CanvasImageSource, 0, 0);
                pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            }
            const width = Math.round(frame.rect.width), height = Math.round(frame.rect.height), uv = frame.uv;
            result = alphaRectangles(width, height, (x, y) => {
                const u = (x + 0.5) / width, v = 1 - (y + 0.5) / height;
                const tx = Math.max(0, Math.min(canvas.width - 1, Math.floor((uv[0] + (uv[2] - uv[0]) * u + (uv[4] - uv[0]) * v) * atlas.width - shiftX)));
                const ty = Math.max(0, Math.min(canvas.height - 1, Math.floor((uv[1] + (uv[3] - uv[1]) * u + (uv[5] - uv[1]) * v) * atlas.height - shiftY)));
                return pixels[(ty * canvas.width + tx) * 4 + 3] >= alpha;
            });
        } catch (error) {
            if (failedAt === undefined) console.warn('[ZombieRoad] Не удалось прочитать контур спрайта; временно используется прямоугольник SpriteFrame, чтение будет повторено', frame.name, error);
            this.maskFailures.set(frame, Date.now());
            return fallback;
        }
        this.maskFailures.delete(frame);
        const variants = this.masks.get(frame) ?? new Map<number, MaskRect[]>();
        variants.set(alpha, result);
        this.masks.set(frame, variants);
        return result;
    }
    private shape(style: SpriteStyle, key: string, y: number, direction = 1, heading = 0, rotation = 0, scale = 1): ContactShape {
        const angle = !style.billboard && style.flipWithDirection ? heading : 0;
        const cacheKey = `${style.frame!.uuid}:${style.contactAlphaThreshold}:${y}:${style.width}:${style.height}:${style.rotation}:${style.lift}:${style.bottomAnchor}:${style.billboard}:${style.flipWithDirection}:${key}:${direction < -0.01}:${angle}:${rotation}:${scale}`;
        let shape = this.shapes.get(cacheKey);
        if (!shape) {
            shape = contactGeometry(style, this.mask(style.frame!, style.contactAlphaThreshold), this.basis, y, direction, heading, rotation, scale);
            if (key.startsWith('car:')) shape = key === 'car:z'
                ? clipContactShape(shape, VEHICLE_CONTACT_HEIGHT_SCALE, 1)
                : clipContactShape(shape, 1, VEHICLE_CONTACT_HEIGHT_SCALE);
            if (this.shapes.size >= 256) this.shapes.clear();
            if (!this.maskFailures.has(style.frame!)) this.shapes.set(cacheKey, shape);
        }
        return shape;
    }
    private zombie(z: Zombie): ContactShape | undefined {
        const style = this.zombieStyle(z);
        if (!style?.frame) return undefined;
        return this.shape(style, 'zombie', 0.1, z.direction.x,
            style.billboard || !style.flipWithDirection ? 0 : Math.atan2(z.direction.x, z.direction.z) * 180 / Math.PI,
            z.state === 'fallen' ? 80 : 0);
    }
    obstacleEntry(z: Zombie, from: Point, obstacle: World['layout']['obstacles'][number]): number | undefined {
        const style = this.settings.useSprites && this.settings.obstacleSprites.find(s => s.type === obstacle.type)?.sprite;
        const zombie = this.zombie(z);
        if (!style || !style.frame || !zombie) {
            const radius = obstacle.radius * OBSTACLE_CONTACT_SCALE;
            return segmentHitsCircle(from, z, obstacle, radius) ? this.circleEntry(from, z, obstacle, radius) : undefined;
        }
        const target = this.shape(style, 'obstacle', 0.13, 1, 0, obstacle.rotation, obstacle.scale);
        const dx = z.x - from.x, dz = z.z - from.z;
        const length = Math.hypot(dx, dz);
        const heading = length > 1e-8 ? { x: dx / length, z: dz / length } : z.direction;
        let cached = this.obstacleBodies.get(z);
        if (!cached || cached.source !== zombie || Math.abs(cached.x - heading.x) > 1e-10 || Math.abs(cached.z - heading.z) > 1e-10) {
            cached = { source: zombie, x: heading.x, z: heading.z, body: obstacleBodyShape(zombie, heading) };
            this.obstacleBodies.set(z, cached);
        }
        return shapeEntry(cached.body, from, z, target, obstacle);
    }
    private circleEntry(from: Point, to: Point, center: Point, radius: number): number {
        const dx = to.x - from.x, dz = to.z - from.z, ox = from.x - center.x, oz = from.z - center.z;
        const c = ox * ox + oz * oz - radius * radius;
        if (c <= 0) return 0;
        const a = dx * dx + dz * dz, b = ox * dx + oz * dz;
        return (-b - Math.sqrt(Math.max(0, b * b - a * c))) / a;
    }
    vehiclePadding(z: Zombie): Point | undefined {
        const shape = this.zombie(z);
        if (!shape?.polygons.length) return undefined;
        const b = shapeBounds(shape);
        return {
            x: Math.max(0.15, Math.abs(b.minX), Math.abs(b.maxX)) + 0.02,
            z: Math.max(0.15, Math.abs(b.minZ), Math.abs(b.maxZ)) + 0.02,
        };
    }
    vehicleEntry(z: Zombie, from: Point, to: Point, car: Vehicle): number | null | undefined {
        const style = this.settings.spriteFor(car.kind), zombie = this.zombie(z);
        if (!style?.frame || !zombie) return undefined;
        const heading = car.axis === 'x' ? car.direction * 90 : car.direction === 1 ? 0 : 180;
        const shape = this.shape(style, `car:${car.axis}`, 0.18, car.direction, heading, style.billboard && car.axis === 'z' ? -90 : 0);
        if (shapeEntry(zombie, from, from, shape, car) !== undefined) {
            const range = (s: ContactShape, at: Point, axis: 'x' | 'z') => {
                const bounds = shapeBounds(s);
                return axis === 'x' ? { min: bounds.minX + at.x, max: bounds.maxX + at.x }
                    : { min: bounds.minZ + at.z, max: bounds.maxZ + at.z };
            };
            const faces = (['x', 'z'] as const).flatMap(axis => {
                const a = range(zombie, from, axis), b = range(shape, car, axis);
                return [{ depth: a.max - b.min, outward: from[axis] - to[axis] },
                    { depth: b.max - a.min, outward: to[axis] - from[axis] }];
            });
            const nearest = Math.min(...faces.map(f => f.depth));
            if (faces.some(f => f.depth <= nearest + 0.00001 && f.outward > 0.00001)) return null;
        }
        return shapeEntry(zombie, from, to, shape, car) ?? null;
    }
    frontHit(car: Vehicle, from: Point, z: Zombie): boolean | undefined {
        const style = this.settings.spriteFor(car.kind), zombie = this.zombie(z);
        if (!style?.frame || !zombie) return undefined;
        const axis = car.axis, cross = axis === 'x' ? 'z' : 'x';
        if ((car[axis] - from[axis]) * car.direction <= 0.00001) return false;
        const heading = car.axis === 'x' ? car.direction * 90 : car.direction === 1 ? 0 : 180;
        const shape = this.shape(style, `car:${car.axis}`, 0.18, car.direction, heading, style.billboard && car.axis === 'z' ? -90 : 0);
        const slugBounds = shapeBounds(zombie), bodyBounds = shapeBounds(shape);
        const lateral = (bounds: ReturnType<typeof shapeBounds>, at: Point) => cross === 'x'
            ? { min: bounds.minX + at.x, max: bounds.maxX + at.x }
            : { min: bounds.minZ + at.z, max: bounds.maxZ + at.z };
        const slugLat = lateral(slugBounds, z), bodyLat = lateral(bodyBounds, from);
        const slugCenter = (slugLat.min + slugLat.max) / 2;
        if (slugCenter < bodyLat.min - 0.00001 || slugCenter > bodyLat.max + 0.00001) return false;
        const front = shapeFront(shape, axis, cross, car.direction, slugLat.min - from[cross], slugLat.max - from[cross]);
        if (front === undefined) return false;
        return shapeEntry(shape, from, car, zombie, z) !== undefined;
    }
}
