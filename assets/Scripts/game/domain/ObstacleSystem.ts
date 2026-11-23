import type { WorldState } from './World';
import type { Point, Zombie } from './Model';

export const OBSTACLE_HOLD_SECONDS = 10;
export const OBSTACLE_CONTACT_SCALE = 0.65;

function circleEntry(from: Point, to: Point, center: Point, radius: number): number | undefined {
    const dx = to.x - from.x, dz = to.z - from.z;
    const ox = from.x - center.x, oz = from.z - center.z;
    const c = ox * ox + oz * oz - radius * radius;
    if (c <= 0) return 0;
    const a = dx * dx + dz * dz;
    if (a === 0) return undefined;
    const b = ox * dx + oz * dz;
    const discriminant = b * b - a * c;
    if (discriminant < 0) return undefined;
    const t = (-b - Math.sqrt(discriminant)) / a;
    return t >= 0 && t <= 1 ? t : undefined;
}
export function segmentHitsCircle(from: Point, to: Point, center: Point, radius: number): boolean {
    return circleEntry(from, to, center, radius) !== undefined;
}
export function applyObstacles(w: WorldState, z: Zombie, from: Point): void {
    if (!w.config.obstaclesEnabled || z.state !== 'walking') return;
    let first: typeof w.layout.obstacles[number] | undefined;
    let entry = Infinity;
    for (const o of w.layout.obstacles) {
        if (z.visitedObstacles.has(o.id)) continue;
        const t = w.spriteContacts ? w.spriteContacts.obstacleEntry(z, from, o) : circleEntry(from, z, o, o.radius * OBSTACLE_CONTACT_SCALE);
        if (t !== undefined && t < entry) { first = o; entry = t; }
    }
    if (!first) return;

    z.x = from.x + (z.x - from.x) * entry;
    z.z = from.z + (z.z - from.z) * entry;
    z.visitedObstacles.add(first.id);
    z.state = 'stuck';
    z.timer = OBSTACLE_HOLD_SECONDS;
    z.boost = 0;
    z.disoriented = 0;
    z.vehicleDetour = undefined;
}
