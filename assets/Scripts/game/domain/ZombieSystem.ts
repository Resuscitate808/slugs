import { applyObstacles } from './ObstacleSystem';
import { updateIdleMovement } from './IdleMovement';
import { moveAroundVehicles } from './VehicleContact';
import type { WorldState } from './World';
import { Zombie, activeZombie, distance, normalize, onRoad } from './Model';

export function reserveSavedPlace(w: WorldState, z: Zombie): void {
    let best: { x: number; z: number } | undefined;
    let bestDistance = Infinity;
    for (let row = 0; row < Math.ceil(w.zombies.length / 16); row++) {
        for (let column = 0; column < 16; column++) {
            const x = column < 8 ? -13.5 + column * 1.5 : 3 + (column - 8) * 1.5;
            const point = { x, z: w.layout.finishZ - 0.65 - row * 1.25 };
            if (w.zombies.some(other => other.savedTarget?.x === point.x && other.savedTarget.z === point.z)) continue;
            const d = distance(z, point);
            if (d < bestDistance) { best = point; bestDistance = d; }
        }
    }
    z.savedTarget = best;
}
function updateSaved(z: Zombie, dt: number): void {
    if (z.teleport) {
        const t = z.teleport;
        const before = t.elapsed;
        t.elapsed = Math.min(t.duration, t.elapsed + dt);

        if (before < t.duration / 2 && t.elapsed >= t.duration / 2 && z.savedTarget) { z.x = z.savedTarget.x; z.z = z.savedTarget.z; }
        if (t.elapsed >= t.duration) {
            if (z.savedTarget) { z.x = z.savedTarget.x; z.z = z.savedTarget.z; }
            z.teleport = undefined;
        }
        return;
    }
    if (!z.savedTarget) return;
    const remaining = distance(z, z.savedTarget);
    if (remaining < 0.0001) return;
    z.direction = normalize(z.savedTarget.x - z.x, z.savedTarget.z - z.z);
    const step = Math.min(remaining, z.speed * dt);
    z.x += z.direction.x * step;
    z.z += z.direction.z * step;
}

export function fall(w: WorldState, z: Zombie): void {
    if (z.immunity > 0 || !activeZombie(z)) return;
    z.state = 'fallen';
    z.timer = w.config.fallDuration;
    z.boost = 0;
    w.events.push({ type: 'fall', id: z.id });
}
export function updateZombies(w: WorldState, dt: number): void {
    for (const z of w.zombies) {
        if (z.state === 'saved') { updateSaved(z, dt); continue; }
        if (!activeZombie(z)) continue;
        if (z.state === 'idle' && z.aimHeld) continue;
        z.immunity = Math.max(0, z.immunity - dt);
        if (z.state === 'fallen' || z.state === 'eating') {
            z.timer -= dt;
            if (z.timer <= 0) {
                z.state = 'walking'; z.direction = w.random.direction(); z.immunity = 2; z.disoriented = 2;
            }
            continue;
        }
        if (z.state === 'stuck') {
            z.timer = Math.max(0, z.timer - dt);
            if (z.timer <= 1e-8) {
                z.timer = 0; z.state = 'walking'; z.disoriented = 0;
                z.direction = normalize(z.goalX - z.x, w.layout.finishZ - 0.5 - z.z);
                w.events.push({ type: 'freed', id: z.id });
            }
            continue;
        }
        if (z.state === 'idle' && z.idleMotion?.profile.mode === 2) {
            updateIdleMovement(z, w.random, dt, step => {
                const m = z.idleMotion!;
                let x = z.x + (m.side ?? 1) * step;
                while (x > 10 || x < -10) {
                    if (x > 10) { x = 20 - x; m.side = -1; }
                    else { x = -20 - x; m.side = 1; }
                }
                z.x = x;
                z.z = Math.max(w.layout.spawnZ - 1.9, Math.min(w.layout.spawnZ + 1.6, z.z));
                z.direction = { x: m.side ?? 1, z: 0 };
                return step > 0;
            });
            continue;
        }
        z.wander -= dt;
        if (z.wander <= 0) {
            z.wander = w.random.range(1.5, 3.5);
            if (z.state === 'idle') z.direction = w.random.direction();
            else z.direction = normalize(z.direction.x + w.random.range(-0.12, 0.12), z.direction.z + w.random.range(-0.12, 0.12));
        }
        const driver = w.drivers.find(d => d.bitten && d.time > 0 && onRoad(z, w.layout));
        z.disoriented = Math.max(0, z.disoriented - dt);
        const targetX = driver ? driver.x : z.goalX;
        const targetZ = driver ? driver.z : w.layout.finishZ - 0.5;
        if (z.state === 'walking' && (driver || z.disoriented === 0)) z.direction = normalize(targetX - z.x, targetZ - z.z);
        const from = { x: z.x, z: z.z };
        const speed = z.speed * w.modifiers.speedMultiplier * (z.state === 'idle' ? 0.3 : 1 + z.boost);
        z.boost = Math.max(0, z.boost - dt * 0.7);
        const advance = (step: number): boolean => {
            const start = { x: z.x, z: z.z };
            if (z.idleMotion && !z.flight && z.state === 'walking') {
                const m = z.idleMotion;
                if (m.profile.mode === 2) {
                    if (Math.abs(z.x) >= w.layout.halfWidth - 1) m.side = z.x > 0 ? -1 : 1;
                    const sx = w.config.unitsPerPixel;
                    const sz = w.config.depthPerPixel;
                    if (sx && sz && sx > 0 && sz > 0) {
                        z.direction = normalize((m.side ?? 1) * sx, -sz);
                        step /= Math.hypot(z.direction.x, z.direction.z * sx / sz);
                    } else z.direction = normalize(m.side ?? 1, -1);
                }
            }
            moveAroundVehicles(z, w.vehicles, step, { x: targetX, z: targetZ }, w.layout.halfWidth,
                w.spriteContacts?.vehiclePadding?.(z), w.spriteContacts?.vehicleEntry
                    ? (a, b, car) => w.spriteContacts!.vehicleEntry!(z, a, b, car) : undefined);
            if (z.state === 'walking') applyObstacles(w, z, start);
            return distance(start, z) > 1e-8;
        };
        if (z.state === 'walking' && z.flight) {
            const flight = z.flight;
            z.direction = { ...flight.direction };
            const step = Math.min(flight.remaining, flight.speed * dt);
            const before = { x: z.x, z: z.z };
            advance(step);
            const moved = distance(before, z);
            flight.remaining = Math.max(0, flight.remaining - moved);
            if (flight.remaining < 1e-8 || moved < step - 1e-6 || z.state !== 'walking') {
                z.flight = undefined;
                z.disoriented = 0;
            }
        } else if (z.state === 'walking' && z.idleMotion) updateIdleMovement(z, w.random, dt, advance);
        else advance(speed * dt);
        if (z.state === 'idle') {
            if (Math.abs(z.x) > 10) z.direction.x *= -1;
            if (z.z < w.layout.spawnZ - 1.8 || z.z > w.layout.spawnZ + 1.5) z.direction.z *= -1;
            z.x = Math.max(-10, Math.min(10, z.x));
            z.z = Math.max(w.layout.spawnZ - 1.9, Math.min(w.layout.spawnZ + 1.6, z.z));
            continue;
        }
        applyObstacles(w, z, from);
        z.x = Math.max(-10, Math.min(10, z.x));
        if (z.state !== 'walking') continue;
        if (z.z <= w.layout.finishZ) {
            reserveSavedPlace(w, z);
            z.state = 'saved'; z.boost = 0;
            w.events.push({ type: 'saved', id: z.id }); continue;
        }
        if (Math.abs(z.x) > w.layout.halfWidth || z.z > Math.max(13, w.layout.spawnZ + 2.5)) {
            z.state = 'lost'; continue;
        }

        for (const d of w.drivers) {
            if (!d.eaten && distance(z, d) < 0.85) {
                d.bitten = true; d.eaten = true; d.time = w.config.eatDuration;
                const car = w.vehicles.find(c => c.id === d.carId);
                if (car) car.abandoned = true;
                z.state = 'eating'; z.timer = w.config.eatDuration;
                for (const other of w.zombies) {
                    if (other.state === 'walking' && onRoad(other, w.layout)) other.direction = normalize(d.x - other.x, d.z - other.z);
                }
                w.remains.push({ id: w.nextId++, source: d.id, x: d.x, z: d.z, bloodRadius: 0.9 });
                break;
            }
        }
    }
}
