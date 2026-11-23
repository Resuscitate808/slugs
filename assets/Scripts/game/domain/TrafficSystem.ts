import { levelRule, type LevelRule } from './LevelRules';
import type { WorldState } from './World';
import { conflictsWithOvertake, updateOvertaking } from './VehicleOvertaking';
import { Vehicle, VehicleKind, Zombie, activeZombie, normalize } from './Model';
import { frontRunsOver, vehicleExtent as extent, vehicleCenter as center } from './VehicleContact';
function laneCenters(w: WorldState): number[] {
    return w.layout.laneCenters.map(z => z + w.config.vehicleOffsetZ);
}
function entryFree(w: WorldState, car: Vehicle): boolean {
    return w.vehicles.every(c => c.id === car.id || Math.abs(center(c, 'x') - center(car, 'x')) >= extent(c, 'x') + extent(car, 'x') + 0.2
        || Math.abs(center(c, 'z') - center(car, 'z')) >= extent(c, 'z') + extent(car, 'z') + 0.2);
}

export function spawnVehicle(w: WorldState, kind?: VehicleKind, lane?: number): Vehicle | undefined {
    if (w.vehicles.length >= w.config.maxVehicles) return undefined;
    const roll = w.random.next();
    const allKinds: VehicleKind[] = ['ordinary', 'jeep', 'pink'];
    let selected = kind ?? allKinds[Math.floor(roll * allKinds.length)];
    const level = w.layout.level;
    const profiles = w.config.vehicleProfiles;
    const allowed: VehicleKind[] = profiles
        ? allKinds.filter(k => {
              const p = profiles[k];
              return !!p && level >= (p.firstLevel ?? 1) && p.weight !== 0;
          })
        : allKinds.slice();
    const available = allowed.slice();
    if (kind) {
        if (!available.includes(kind)) return undefined;
    } else {
        if (!available.length) return undefined;
        selected = available[Math.floor(roll * available.length)];
    }
    const indices = w.layout.laneCenters.map((_, i) => i);
    const candidates = (lane === undefined ? indices : [lane]).filter(i => indices.includes(i)).map(index => {
        const direction = w.layout.laneDirections[index];
        const laneCenter = laneCenters(w)[index];
        const car: Vehicle = {
            id: 0, kind: selected, shapes: w.config.vehicleShapes[selected], axis: 'x',
            lane: laneCenter, targetLane: laneCenter,
            x: 0, z: laneCenter,
            direction, speed: 0, cruise: 0, stopped: 0, reaction: 0, hits: 0,
            driverCreated: false, abandoned: false, collisionCooldown: 0,
        };
        const bounds = w.trafficBounds ?? { left: -w.layout.halfWidth, right: w.layout.halfWidth };
        const margin = w.config.levelTable ? 0.001 : 1;
        const edge = direction > 0 ? bounds.left - margin : bounds.right + margin;
        car.x = edge - direction * extent(car, 'x') - (center(car, 'x') - car.x);
        return car;
    }).filter(car => entryFree(w, car) && !w.vehicles.some(other => conflictsWithOvertake(car, other)) && w.vehicles.every(other =>
        other.axis !== car.axis || other.direction === car.direction
        || Math.abs(center(other, 'z') - center(car, 'z')) >= extent(other, 'z') + extent(car, 'z') + 0.2));
    if (!candidates.length) return undefined;
    const car = candidates[Math.floor(w.random.range(0, candidates.length))];
    car.id = w.nextId++;
    car.speed = car.cruise = profiles?.[selected]?.speed
        ?? (selected === 'jeep' ? 6.5 : selected === 'pink' ? 2.6 : 4.2) * w.random.range(0.85, 1.15);
    w.vehicles.push(car);
    return car;
}
function createDriver(w: WorldState, car: Vehicle, bitten: boolean): void {
    if (!w.config.driverExitEnabled || car.driverCreated) return;
    car.driverCreated = true;
    car.stopped = w.config.driverInspectDuration;
    const d = { id: w.nextId++, carId: car.id, x: car.x, z: car.z + 1.05, time: w.config.driverInspectDuration, bitten, eaten: false };
    w.drivers.push(d);
    w.events.push({ type: 'driver', id: d.id });
}
export function hitZombie(w: WorldState, car: Vehicle, z: Zombie): void {
    if (!activeZombie(z)) return;
    z.state = 'dead'; car.hits++;
    w.remains.push({ id: w.nextId++, source: z.id, x: z.x, z: z.z, bloodRadius: 0.9 });
    w.events.push({ type: 'hit', id: z.id });
    if (car.kind === 'ordinary' && !car.driverCreated && w.random.chance(w.config.driverExitChance)) createDriver(w, car, true);
}
export function crash(w: WorldState, car: Vehicle): void {
    if (car.collisionCooldown > 0) return;
    car.collisionCooldown = 2;
    w.events.push({ type: 'crash', id: car.id });
    if (car.kind === 'jeep') return;
    if (car.kind === 'pink') {
        car.speed = car.cruise * 2.5; car.reaction = 4;


        return;
    }
    if (car.hits === 0) createDriver(w, car, false);
    else car.stopped = 0;
}
function steer(w: WorldState, car: Vehicle): void {
    if (car.kind === 'ordinary' || car.axis !== 'x') return;
    const range = car.kind === 'jeep' ? 6 * w.modifiers.jeepDetectionMultiplier : 5;
    const target = w.zombies.find(z => activeZombie(z) && (z.x - car.x) * car.direction > 0 && (z.x - car.x) * car.direction < range && Math.abs(z.z - car.z) < 2.2);
    if (!target) return;

    const centers = laneCenters(w);
    const origin = centers.indexOf(car.lane);
    if (origin < 0 || w.layout.laneDirections[origin] !== car.direction) return;
    let first = origin, last = origin;
    while (first > 0 && w.layout.laneDirections[first - 1] === car.direction) first--;
    while (last + 1 < w.layout.laneCenters.length && w.layout.laneDirections[last + 1] === car.direction) last++;
    const sameDirection = centers.slice(first, last + 1);
    if (car.kind === 'jeep') {
        car.targetLane = sameDirection.reduce((a, b) => Math.abs(a - target.z) < Math.abs(b - target.z) ? a : b);
        car.speed = car.cruise * 1.25;
    } else {
        car.targetLane = sameDirection.reduce((a, b) => Math.abs(a - target.z) > Math.abs(b - target.z) ? a : b);
        car.speed = car.cruise * 0.8;
    }
    const laneFree = w.vehicles.every(other => other === car
        || Math.abs(center(other, 'z') - (center(car, 'z') + car.targetLane - car.z)) >= extent(other, 'z') + extent(car, 'z') + 0.2
        || Math.abs(center(other, 'x') - center(car, 'x')) >= extent(other, 'x') + extent(car, 'x') + 0.6 + Math.max(car.speed, other.speed) * 0.5);
    if (!laneFree) car.targetLane = car.lane;
    car.reaction = 1;
}
function moveVehicle(w: WorldState, car: Vehicle, dx: number, dz: number): void {
    let fraction = 1;
    let obstacle: Vehicle | undefined;
    for (const other of w.vehicles) {
        if (other === car) continue;
        let enter = -Infinity, leave = Infinity;
        for (const axis of ['x', 'z'] as const) {
            const offset = center(car, axis) - center(other, axis);
            const delta = axis === 'x' ? dx : dz;
            const size = extent(car, axis) + extent(other, axis) + (axis === 'x' ? w.config.queueGap ?? 0.2 : 0.2);
            if (Math.abs(delta) < 0.000001) {
                if (Math.abs(offset) >= size) { enter = Infinity; break; }
            } else {
                const a = (-size - offset) / delta, b = (size - offset) / delta;
                enter = Math.max(enter, Math.min(a, b));
                leave = Math.min(leave, Math.max(a, b));
            }
        }
        if (enter <= leave && leave > 0 && enter >= -0.00001 && enter < fraction) {
            fraction = Math.max(0, enter - 0.00001);
            obstacle = other;
        }
    }
    const from = { x: car.x, z: car.z };
    car.x += dx * fraction;
    car.z += dz * fraction;
    for (const z of w.zombies) if (activeZombie(z)) {
        const hit = w.spriteContacts?.frontHit(car, from, z) ?? frontRunsOver(car, from, z);
        if (hit) hitZombie(w, car, z);
    }
    if (obstacle && (car.axis !== obstacle.axis || car.direction !== obstacle.direction)) {
        crash(w, car); crash(w, obstacle);
    }
    if (Math.abs(car.z - car.targetLane) < 0.001 && car.axis === 'x') car.lane = car.targetLane;
}
interface LaneSpawnState {
    timer: number;
    previous?: Vehicle;
    edge: number;
}
interface SpawnDeckState { deck: VehicleKind[]; last?: VehicleKind }
const spawnDecks = new WeakMap<WorldState, SpawnDeckState>();
function availableLaneKinds(w: WorldState, rule: LevelRule): VehicleKind[] {
    const kinds: VehicleKind[] = ['ordinary', 'jeep', 'pink'];
    const profiles = w.config.vehicleProfiles;
    if (profiles) {
        return kinds.filter(kind => {
            const profile = profiles[kind];
            return !profile || (w.layout.level >= (profile.firstLevel ?? 1) && profile.weight !== 0);
        });
    }
    return kinds;
}
function nextLaneKind(w: WorldState, state: LaneSpawnState, rule: LevelRule, lane: number): VehicleKind | undefined {
    const kinds = availableLaneKinds(w, rule);
    if (!kinds.length) return undefined;
    if (kinds.length === 1) return kinds[0];

    const laneKind = rule.lanes[lane];
    if (laneKind && kinds.includes(laneKind)) return laneKind;

    let deckState = spawnDecks.get(w);
    if (!deckState) {
        deckState = { deck: [] };
        spawnDecks.set(w, deckState);
    }
    if (!deckState.deck.length) {
        deckState.deck = kinds.slice();
        for (let i = deckState.deck.length - 1; i > 0; i--) {
            const j = Math.floor(w.random.next() * (i + 1));
            [deckState.deck[i], deckState.deck[j]] = [deckState.deck[j], deckState.deck[i]];
        }
        if (deckState.last !== undefined && deckState.deck.length > 1
            && deckState.deck[deckState.deck.length - 1] === deckState.last) {
            const index = deckState.deck.findIndex(kind => kind !== deckState!.last);
            if (index >= 0) [deckState.deck[index], deckState.deck[deckState.deck.length - 1]] =
                [deckState.deck[deckState.deck.length - 1], deckState.deck[index]];
        }
    }
    const kind = deckState.deck.pop()!;
    deckState.last = kind;
    return kind;
}
const laneTimers = new WeakMap<WorldState, LaneSpawnState[]>();
function updateLaneSpawns(w: WorldState, dt: number): void {
    const rule = levelRule(w.layout.level);
    let timers = laneTimers.get(w);
    if (!timers) {
        const entryGap = rule.entryGap ?? 0;
        timers = w.layout.laneCenters.map((_, lane) => ({
            timer: entryGap > 0 ? 1 + lane * entryGap + w.random.range(0, 1) : w.random.range(0, 2),
            edge: 0,
        }));
        laneTimers.set(w, timers);
        spawnDecks.set(w, { deck: [] });
    }
    timers.forEach((state, lane) => {
        if (state.previous) {
            const car = state.previous;
            const tail = center(car, 'x') - car.direction * extent(car, 'x');
            if ((tail - state.edge) * car.direction < 0 && w.vehicles.includes(car)) return;
            state.previous = undefined;
            const index = (w.layout.level - 1) * 2;
            const configuredMin = w.config.spawnPauses?.[index];
            const configuredMax = w.config.spawnPauses?.[index + 1];
            const pauseMin = rule.entryGap === undefined ? configuredMin ?? rule.pauseMin : Math.max(rule.pauseMin, configuredMin ?? 0);
            const pauseMax = rule.entryGap === undefined ? configuredMax ?? rule.pauseMax : Math.max(rule.pauseMax, configuredMax ?? 0);
            state.timer = w.random.range(pauseMin, Math.max(pauseMin, pauseMax));
            return;
        }
        state.timer -= dt;
        if (state.timer > 0) return;
        const kind = nextLaneKind(w, state, rule, lane);
        if (!kind) return;
        const car = spawnVehicle(w, kind, lane);
        if (!car) return;
        const bounds = w.trafficBounds ?? { left: -w.layout.halfWidth, right: w.layout.halfWidth };
        state.previous = car;
        state.edge = car.direction > 0 ? bounds.left : bounds.right;
    });
}
export function updateTraffic(w: WorldState, dt: number, spawn: boolean): void {
    if (w.config.levelTable) updateLaneSpawns(w, dt);
    else if (spawn && w.vehicles.length < w.config.maxVehicles) spawnVehicle(w);
    for (const car of w.vehicles) {
        car.collisionCooldown = Math.max(0, car.collisionCooldown - dt);
        if (car.abandoned) continue;
        if (car.stopped > 0) { car.stopped = Math.max(0, car.stopped - dt); continue; }
        car.reaction -= dt;
        if (w.config.levelTable) { car.overtake = undefined; car.targetLane = car.lane; car.speed = car.cruise; }
        const overtaking = !w.config.levelTable && updateOvertaking(w, car);
        if (overtaking) { if (car.reaction <= 0) car.speed = car.cruise; }
        else if (car.reaction <= 0) { car.speed = car.cruise; if (!w.config.levelTable) steer(w, car); }
        let travel = car.direction * car.speed * dt;
        if (car.overtake && !car.overtake.returning && Math.abs(car.z - car.targetLane) > 0.001) {
            const leader = w.vehicles.find(other => other.id === car.overtake!.leaderId);
            travel = car.direction * Math.min(car.speed, leader && !leader.abandoned && leader.stopped <= 0 ? leader.speed : 0) * dt;
        }
        const lateral = Math.sign(car.targetLane - car.z) * Math.min(Math.abs(car.targetLane - car.z), dt * car.speed);
        if (car.axis === 'x' && Math.abs(lateral) > 0) {
            moveVehicle(w, car, 0, lateral);
            moveVehicle(w, car, travel, 0);
        } else {
            moveVehicle(w, car, car.axis === 'x' ? travel : 0, car.axis === 'x' ? 0 : travel);
        }
    }
    for (let i = 0; i < w.vehicles.length; i++) {
        const a = w.vehicles[i];
        for (let j = i + 1; j < w.vehicles.length; j++) {
            const b = w.vehicles[j];
            const hx = extent(a, 'x') + extent(b, 'x');
            const hz = extent(a, 'z') + extent(b, 'z');
            const dx = center(a, 'x') - center(b, 'x'), dz = center(a, 'z') - center(b, 'z');
            if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
                const axis = a.axis === b.axis ? a.axis : hx - Math.abs(dx) < hz - Math.abs(dz) ? 'x' : 'z';
                const separation = (axis === 'x' ? hx : hz) + 0.21 - Math.abs(axis === 'x' ? dx : dz);
                const sign = Math.sign(axis === 'x' ? dx : dz) || a.direction;
                if (a.abandoned || a.stopped > 0) b[axis] -= sign * separation;
                else if (b.abandoned || b.stopped > 0) a[axis] += sign * separation;
                else { a[axis] += sign * separation / 2; b[axis] -= sign * separation / 2; }
                crash(w, a); crash(w, b);
            }
        }
    }
    for (const d of w.drivers) {
        d.time -= dt;
        if (d.bitten) {
            for (const z of w.zombies) if (z.state === 'walking' && Math.abs(z.z) < w.layout.roadHalf) z.direction = normalize(d.x - z.x, d.z - z.z);
        }
        if (d.eaten) {
            const car = w.vehicles.find(c => c.id === d.carId);
            if (car) car.stopped = Math.max(car.stopped, 1);
        }
    }
    w.drivers = w.drivers.filter(d => d.time > 0);
    const bounds = w.trafficBounds ?? { left: -w.layout.halfWidth, right: w.layout.halfWidth };
    w.vehicles = w.vehicles.filter(c => (c.axis === 'x'
        ? c.direction > 0 ? center(c, 'x') - extent(c, 'x') < Math.max(20, bounds.right + 1)
            : center(c, 'x') + extent(c, 'x') > Math.min(-20, bounds.left - 1)
        : Math.abs(center(c, 'x')) - extent(c, 'x') < Math.max(20, Math.abs(bounds.left), Math.abs(bounds.right)) + 1)
        && Math.abs(center(c, 'z')) - extent(c, 'z') < 17 + Math.abs(w.config.vehicleOffsetZ));
}
