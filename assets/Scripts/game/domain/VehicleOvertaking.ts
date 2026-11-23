import type { WorldState } from './World';
import type { Vehicle } from './Model';
import { vehicleCenter as center, vehicleExtent as extent } from './VehicleContact';

export function forwardGap(car: Vehicle, other: Vehicle): number {
    return (center(other, 'x') - center(car, 'x')) * car.direction - extent(car, 'x') - extent(other, 'x');
}

function leaderAhead(w: WorldState, car: Vehicle): Vehicle | undefined {
    return w.vehicles.filter(other => other !== car && other.axis === 'x' && other.direction === car.direction
        && (center(other, 'x') - center(car, 'x')) * car.direction > 0
        && Math.abs(center(other, 'z') - center(car, 'z')) < extent(other, 'z') + extent(car, 'z') + 0.2)
        .sort((a, b) => forwardGap(car, a) - forwardGap(car, b))[0];
}

function drivingSpeed(car: Vehicle): number {
    return Math.max(0, car.reaction > 0 ? car.speed : car.cruise);
}

function availableSpeed(w: WorldState, car: Vehicle, visited = new Set<number>()): number {
    if (car.abandoned || car.stopped > 0 || visited.has(car.id)) return 0;
    visited.add(car.id);
    const speed = drivingSpeed(car);
    const leader = leaderAhead(w, car);
    if (!leader) return speed;
    return Math.min(speed, availableSpeed(w, leader, visited) + Math.max(0, forwardGap(car, leader) - 0.2) / 0.5);
}

export function reservedCorridor(car: Vehicle): [number, number] {
    const offset = center(car, 'z') - car.z;
    const points = car.overtake ? [car.overtake.home, car.overtake.passing, car.z] : [car.z];
    return [Math.min(...points) + offset - extent(car, 'z') - 0.2,
        Math.max(...points) + offset + extent(car, 'z') + 0.2];
}

export function conflictsWithOvertake(car: Vehicle, other: Vehicle): boolean {
    if (!other.overtake) return false;
    const [low, high] = reservedCorridor(other);
    return center(car, 'z') + extent(car, 'z') > low && center(car, 'z') - extent(car, 'z') < high;
}

export function updateOvertaking(w: WorldState, car: Vehicle): boolean {
    if (car.axis !== 'x' || car.kind === 'jeep') return false;
    const ownSpeed = drivingSpeed(car);
    const state = car.overtake;
    if (state) {
        const leader = w.vehicles.find(other => other.id === state.leaderId);
        if (!state.returning && (!leader || forwardGap(leader, car) > 1)) {
            const homeCenter = center(car, 'z') + state.home - car.z;
            const low = Math.min(homeCenter, center(car, 'z')) - extent(car, 'z') - 0.2;
            const high = Math.max(homeCenter, center(car, 'z')) + extent(car, 'z') + 0.2;
            const returnTime = Math.abs(state.home - car.z) / Math.max(ownSpeed, 0.01);
            const blocked = w.vehicles.some(other => {
                if (other === car || center(other, 'z') + extent(other, 'z') <= low
                    || center(other, 'z') - extent(other, 'z') >= high) return false;
                const distance = (center(other, 'x') - center(car, 'x')) * car.direction;
                const relative = availableSpeed(w, other) * other.direction * car.direction - ownSpeed;
                const future = distance + relative * returnTime;
                const clearance = extent(car, 'x') + extent(other, 'x') + 0.6;
                return Math.min(distance, future) < clearance && Math.max(distance, future) > -clearance;
            });
            if (!blocked) state.returning = true;
        }
        car.targetLane = state.returning ? state.home : state.passing;
        if (state.returning && Math.abs(car.z - state.home) < 0.001) {
            car.lane = state.home;
            car.overtake = undefined;
        }
        return true;
    }
    const centers = w.layout.laneCenters.map(z => z + w.config.vehicleOffsetZ);
    const origin = centers.findIndex(z => Math.abs(z - car.z) < 0.001);
    if (origin < 0 || Math.abs(car.targetLane - car.z) > 0.001) return false;
    const leader = leaderAhead(w, car);
    if (!leader || leader.overtake) return false;
    const speed = availableSpeed(w, leader);
    const gap = forwardGap(car, leader);
    if (ownSpeed <= speed + 0.3 || gap > 0.2 + (ownSpeed - speed) * 0.5) return false;
    for (const index of [origin - 1, origin + 1]) {
        if (index < 0 || index >= centers.length) continue;
        const side = Math.sign(index - origin);
        const projected = center(car, 'z') + centers[index] - car.z;
        const clearance = extent(car, 'z') + extent(leader, 'z') + 0.4;
        const adjustment = Math.max(0, clearance - (projected - center(leader, 'z')) * side);
        if (adjustment > w.layout.laneWidth / 4) continue;
        const passing = centers[index] + side * adjustment;
        const proposal = { ...car, overtake: { home: car.z, passing, leaderId: leader.id, returning: false } };
        const [a, b] = reservedCorridor(proposal);
        if (w.vehicles.some(other => other !== car && other !== leader && (() => {
            const [c, d] = reservedCorridor(other);
            if (a >= d || b <= c) return false;
            const passingCenter = center(car, 'z') + passing - car.z;
            if (!other.overtake && other.axis === 'x' && other.direction === car.direction
                && Math.abs(other.z - car.z) < 0.001 && Math.abs(other.targetLane - other.z) < 0.001
                && Math.abs(passingCenter - center(other, 'z')) >= extent(car, 'z') + extent(other, 'z') + 0.2
                && Math.abs(center(car, 'x') - center(other, 'x')) >= extent(car, 'x') + extent(other, 'x') + 0.199) return false;
            const behind = (center(car, 'x') - center(other, 'x')) * car.direction;
            const clearance = extent(car, 'x') + extent(other, 'x') + 0.6;
            if (!other.overtake && other.axis === 'x' && other.direction === car.direction
                && Math.abs(other.targetLane - other.z) < 0.001 && behind < -clearance
                && availableSpeed(w, other) >= ownSpeed) return false;
            if (!other.overtake && other.axis === 'x' && behind > clearance) {
                if (other.direction !== car.direction) return false;
                const otherSpeed = availableSpeed(w, other);
                const departureTime = Math.abs(passing - car.z) / Math.max(ownSpeed, 0.01);
                if (behind - clearance > Math.max(0, otherSpeed - speed) * departureTime
                    && otherSpeed <= ownSpeed) return false;
            }
            return true;
        })())) continue;
        car.overtake = proposal.overtake;
        car.targetLane = passing;
        return true;
    }
    return false;
}
