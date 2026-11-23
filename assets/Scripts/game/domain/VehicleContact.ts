import { Point, Vehicle, Zombie } from './Model';

export function vehicleBounds(car: Vehicle) {
    return car.shapes?.[car.axis === 'x'
        ? car.direction > 0 ? 'xPositive' : 'xNegative'
        : car.direction > 0 ? 'zPositive' : 'zNegative'];
}
export function vehicleExtent(car: Vehicle, axis: 'x' | 'z'): number {
    const bounds = vehicleBounds(car);
    return bounds ? axis === 'x' ? bounds.halfX : bounds.halfZ : car.axis === axis ? 1.2 : 0.6;
}
export function vehicleCenter(car: Vehicle, axis: 'x' | 'z'): number {
    const bounds = vehicleBounds(car);
    return car[axis] + (bounds ? axis === 'x' ? bounds.offsetX : bounds.offsetZ : 0);
}
export const VEHICLE_CONTACT_HEIGHT_SCALE = 0.8;
export function vehicleContactExtent(car: Vehicle, axis: 'x' | 'z'): number {
    return vehicleExtent(car, axis) * (axis === car.axis ? 1 : VEHICLE_CONTACT_HEIGHT_SCALE);
}
const ZOMBIE_RADIUS = 0.15;
const EPSILON = 0.00001;
const QUEUE_GAP = 0.6;
type Barrier = { min: Point; max: Point; axis: 'x' | 'z'; direction: number; cars: Vehicle[] };

export function frontRunsOver(car: Vehicle, from: Point, zombie: Point): boolean {
    const axis = car.axis, cross = axis === 'x' ? 'z' : 'x', direction = car.direction;
    const travel = (car[axis] - from[axis]) * direction;
    if (travel <= EPSILON) return false;
    const front = from[axis] + vehicleCenter(car, axis) - car[axis] + direction * (vehicleContactExtent(car, axis) + ZOMBIE_RADIUS);
    const distance = (zombie[axis] - front) * direction;
    if (distance < -EPSILON || distance > travel + EPSILON) return false;
    const t = Math.max(0, Math.min(1, distance / travel));
    const center = from[cross] + vehicleCenter(car, cross) - car[cross] + (car[cross] - from[cross]) * t;
    return Math.abs(zombie[cross] - center) < vehicleContactExtent(car, cross) + ZOMBIE_RADIUS;
}

function barriers(vehicles: Vehicle[]): Barrier[] {
    const result = vehicles.map(car => ({
        min: { x: vehicleCenter(car, 'x') - vehicleContactExtent(car, 'x'), z: vehicleCenter(car, 'z') - vehicleContactExtent(car, 'z') },
        max: { x: vehicleCenter(car, 'x') + vehicleContactExtent(car, 'x'), z: vehicleCenter(car, 'z') + vehicleContactExtent(car, 'z') },
        axis: car.axis, direction: car.direction, cars: [car],
    }));
    for (let i = 0; i < result.length; i++) {
        const a = result[i], axis = a.axis, cross = axis === 'x' ? 'z' : 'x';
        for (let j = i + 1; j < result.length; j++) {
            const b = result[j];
            if (b.axis !== axis || b.direction !== a.direction
                || Math.min(a.max[cross], b.max[cross]) <= Math.max(a.min[cross], b.min[cross])
                || Math.max(a.min[axis], b.min[axis]) - Math.min(a.max[axis], b.max[axis]) > QUEUE_GAP) continue;
            for (const key of ['x', 'z'] as const) {
                a.min[key] = Math.min(a.min[key], b.min[key]);
                a.max[key] = Math.max(a.max[key], b.max[key]);
            }
            a.cars.push(...b.cars);
            result.splice(j, 1);
            j = i;
        }
    }
    return result;
}

function entry(box: Barrier, from: Point, to: Point, padding: Point): number | undefined {
    const faces = (['x', 'z'] as const).flatMap(axis => [
        { distance: from[axis] - (box.min[axis] - padding[axis]), outward: from[axis] - to[axis] },
        { distance: box.max[axis] + padding[axis] - from[axis], outward: to[axis] - from[axis] },
    ]);
    if (faces.every(face => face.distance > 0)) {
        const nearest = Math.min(...faces.map(face => face.distance));
        if (faces.some(face => face.distance <= nearest + EPSILON && face.outward > EPSILON)) return undefined;
    }
    let enter = -Infinity, leave = Infinity;
    for (const axis of ['x', 'z'] as const) {
        const min = box.min[axis] - padding[axis], max = box.max[axis] + padding[axis];
        const delta = to[axis] - from[axis];
        if (Math.abs(delta) < EPSILON) {
            if (from[axis] <= min || from[axis] >= max) return undefined;
        } else {
            const a = (min - from[axis]) / delta, b = (max - from[axis]) / delta;
            enter = Math.max(enter, Math.min(a, b));
            leave = Math.min(leave, Math.max(a, b));
        }
    }
    if (enter > leave || leave <= 0 || enter > 1) return undefined;
    return Math.max(0, enter);
}

export function moveAroundVehicles(zombie: Zombie, vehicles: Vehicle[], step: number, _goal: Point, _halfWidth: number,
    padding: Point = { x: ZOMBIE_RADIUS, z: ZOMBIE_RADIUS },
    contourEntry?: (from: Point, to: Point, car: Vehicle) => number | null | undefined): void {
    zombie.vehicleDetour = undefined;
    const from = { x: zombie.x, z: zombie.z };
    const to = { x: from.x + zombie.direction.x * step, z: from.z + zombie.direction.z * step };
    let fraction = 1;
    for (const box of barriers(vehicles)) {
        const contour = box.cars.length === 1 ? contourEntry?.(from, to, box.cars[0]) : undefined;
        const hit = contour === undefined ? entry(box, from, to, padding) : contour === null ? undefined : contour;
        if (hit !== undefined) fraction = Math.min(fraction, Math.max(0, hit - EPSILON));
    }
    if (fraction < 1 && zombie.state === 'walking') zombie.disoriented = 0;
    zombie.x = from.x + (to.x - from.x) * fraction;
    zombie.z = from.z + (to.z - from.z) * fraction;
}
