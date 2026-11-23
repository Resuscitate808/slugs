import { DEFAULT_CONFIG, DEFAULT_MODIFIERS, GameConfig, GameEvent, LevelLayout, Modifiers, Random, Zombie, Vehicle, Remains, Driver, RoundResult, Point, activeZombie, createLayout, normalize, score } from './Model';
import type { LevelDefinition } from './LevelCatalog';
import { reserveSavedPlace, updateZombies } from './ZombieSystem';
import { levelRule } from './LevelRules';
import { updateTraffic } from './TrafficSystem';

export interface SpriteContacts {
    vehiclePadding?(zombie: Zombie): Point | undefined;
    vehicleEntry?(zombie: Zombie, from: Point, to: Point, car: Vehicle): number | null | undefined;
    obstacleEntry(zombie: Zombie, from: Point, obstacle: LevelLayout['obstacles'][number]): number | undefined;
    frontHit(car: Vehicle, from: Point, zombie: Zombie): boolean | undefined;
}
export interface WorldState {
    spriteContacts?: SpriteContacts;
    config: GameConfig;
    modifiers: Modifiers;
    layout: LevelLayout;
    trafficBounds?: { left: number; right: number };
    random: Random;
    zombies: Zombie[];
    vehicles: Vehicle[];
    remains: Remains[];
    drivers: Driver[];
    events: GameEvent[];
    nextId: number;
}
export class World implements WorldState {
    spriteContacts?: SpriteContacts;
    readonly config: GameConfig;
    readonly modifiers: Modifiers;
    readonly layout: LevelLayout;
    trafficBounds?: { left: number; right: number };
    readonly random: Random;
    zombies: Zombie[] = [];
    vehicles: Vehicle[] = [];
    remains: Remains[] = [];
    drivers: Driver[] = [];
    events: GameEvent[] = [];
    nextId = 1;
    elapsed = 0;
    result: RoundResult | null = null;
    paused = false;

    slowTime = 0;
    slowFactor = 1;
    private accumulator = 0;
    private spawnTimer = 1.2;

    constructor(level = 1, seed = 42, config: Partial<GameConfig> = {}, modifiers: Partial<Modifiers> = {}, definition?: LevelDefinition) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.config.zombieCount = Math.max(0, Math.min(100, Math.round(this.config.zombieCount) || 0));
        this.config.spawnOffsetZ = Number.isFinite(this.config.spawnOffsetZ) ? this.config.spawnOffsetZ : DEFAULT_CONFIG.spawnOffsetZ;
        this.config.duration = Math.max(10, this.config.duration);
        this.config.trafficInterval = Math.max(0.3, this.config.trafficInterval);
        this.modifiers = { ...DEFAULT_MODIFIERS, ...modifiers };
        this.config.laneOffsetZ = Number.isFinite(this.config.laneOffsetZ) ? this.config.laneOffsetZ : DEFAULT_CONFIG.laneOffsetZ;
        this.config.vehicleOffsetZ = Number.isFinite(this.config.vehicleOffsetZ) ? this.config.vehicleOffsetZ : DEFAULT_CONFIG.vehicleOffsetZ;

        this.config.laneWidths = DEFAULT_CONFIG.laneWidths.map((fallback, index) => {
            const width = this.config.laneWidths?.[index];
            return Number.isFinite(width) ? Math.max(1.4, width) : fallback;
        });
        this.layout = createLayout(level, definition, this.config.laneWidths[level - 1], this.config.laneOffsetZ);
        if (this.config.levelTable) {
            const rule = levelRule(level);
            const count = rule.lanes.length;
            this.layout.laneDirections = rule.lanes.map((_, i) => (count - 1 - i) % 2 === 0 ? 1 : -1);
            this.layout.laneCenters = rule.lanes.map((_, i) => this.config.laneOffsetZ + (i - (count - 1) / 2) * this.layout.laneWidth);
            this.layout.roadHalf = count * this.layout.laneWidth / 2;
            this.layout.halfWidth = 1900 * (this.config.unitsPerPixel ?? 36 / 3800);
        }
        this.layout.spawnZ += this.config.spawnOffsetZ;
        this.config.finishOffsetZ = Number.isFinite(this.config.finishOffsetZ) ? this.config.finishOffsetZ : DEFAULT_CONFIG.finishOffsetZ;
        this.layout.finishZ += this.config.finishOffsetZ;
        if (this.config.levelTable) this.layout.finishZ = Math.min(this.layout.finishZ, this.config.laneOffsetZ - this.layout.roadHalf - 0.65);
        this.random = new Random(seed);
        for (let i = 0; i < this.config.zombieCount; i++) {
            this.zombies.push({
                id: this.nextId++, x: -10 + (i % 10) * (20 / 9), z: this.layout.spawnZ - 1.2 + Math.floor(i / 10) * 1.05 % 3,
                state: 'idle', direction: this.random.direction(), speed: this.config.zombieSpeed * this.random.range(0.85, 1.15),
                goalX: -10 + (i % 10) * (20 / 9), disoriented: 0,
                timer: 0, immunity: 0, wander: this.random.range(1, 3), boost: 0, ditchMask: 0, visited: new Set(), visitedObstacles: new Set(),
            });
        }
    }
    launchVector(pull: Point): Point {
        if (!Number.isFinite(pull.x) || !Number.isFinite(pull.z) || pull.z >= 0) return { x: 0, z: 0 };
        if (!this.config.levelTable) return pull;
        const sx = this.config.unitsPerPixel ?? 36 / 3800;
        const sz = this.config.depthPerPixel ?? sx;
        const pixels = Math.hypot(pull.x / sx, pull.z / sz);
        if (!(pixels > 0)) return { x: 0, z: 0 };
        const length = Math.max(this.config.flightMinPixels ?? 110, Math.min(this.config.flightMaxPixels ?? 220, pixels));
        return { x: pull.x * length / pixels, z: pull.z * length / pixels };
    }
    launch(id: number, pull: Point): boolean {
        const z = this.zombies.find(item => item.id === id);
        if (this.paused || this.result || !z || z.state !== 'idle') return false;
        if (!Number.isFinite(pull.x) || !Number.isFinite(pull.z) || pull.z >= 0 || Math.hypot(pull.x, pull.z) < 0.25) return false;
        z.vehicleDetour = undefined;
        z.direction = normalize(pull.x, pull.z);
        z.goalX = Math.max(-this.layout.halfWidth + 1, Math.min(this.layout.halfWidth - 1,
            z.x + z.direction.x * Math.max(0, z.z - this.layout.finishZ) / Math.max(0.25, -z.direction.z)));
        z.disoriented = 1.5;
        z.boost = Math.min(1.6, Math.hypot(pull.x, pull.z) * 0.3);
        z.state = 'walking';
        if (this.config.levelTable) {
            const sx = this.config.unitsPerPixel ?? 36 / 3800;
            const sz = this.config.depthPerPixel ?? sx;
            const vector = this.launchVector(pull);
            const length = Math.hypot(vector.x / sx, vector.z / sz);
            const distance = Math.hypot(vector.x, vector.z);
            z.flight = { direction: { ...z.direction }, remaining: distance, speed: distance / length * (this.config.flightSpeedPixels ?? 1760) };
            z.boost = 0;
            if (z.idleMotion) z.idleMotion.height = 0;
        }
        this.events.push({ type: 'launched', id });
        return true;
    }

    slowTraffic(duration: number, factor: number): boolean {
        if (this.paused || this.result || !(duration > 0) || !(factor > 0 && factor < 1)) return false;
        this.slowTime = duration;
        this.slowFactor = factor;
        this.events.push({ type: 'slowed', id: 0 });
        return true;
    }

    teleport(id: number, duration = 0.6): boolean {
        const z = this.zombies.find(item => item.id === id);
        if (this.paused || this.result || !z || !activeZombie(z)) return false;
        reserveSavedPlace(this, z);
        z.teleport = { from: { x: z.x, z: z.z }, elapsed: 0, duration: Math.max(0.05, duration) };
        z.state = 'saved'; z.boost = 0; z.timer = 0; z.vehicleDetour = undefined;
        this.events.push({ type: 'teleported', id }, { type: 'saved', id });
        return true;
    }
    update(delta: number): void {
        if (this.paused || this.result || !Number.isFinite(delta) || delta <= 0) return;
        this.accumulator += Math.min(delta, 0.25);
        while (this.accumulator >= 1 / 60 && !this.result) {
            this.step(1 / 60);
            this.accumulator -= 1 / 60;
        }
    }
    finish(): RoundResult {
        if (this.result) return this.result;
        for (const z of this.zombies) if (activeZombie(z)) z.state = 'lost';
        this.result = score(this.zombies.filter(z => z.state === 'saved').length, this.zombies.length);
        if (this.config.levelTable) this.result.won = this.result.saved >= levelRule(this.layout.level).target;
        this.events.push({ type: 'finished', id: 0 });
        return this.result;
    }
    drainEvents(): GameEvent[] { return this.events.splice(0); }
    private step(dt: number): void {
        this.elapsed += dt;
        const trafficDt = this.slowTime > 0 ? dt * this.slowFactor : dt;
        this.slowTime = Math.max(0, this.slowTime - dt);
        this.spawnTimer -= trafficDt;
        updateTraffic(this, trafficDt, this.spawnTimer <= 0);
        if (this.spawnTimer <= 0) {
            const intervalMultiplier = [2, 1.7, 1.4, 1.2, 1][this.layout.level - 1] ?? 1;
            this.spawnTimer = this.config.trafficInterval / (1 + (this.layout.level - 1) * 0.12) * intervalMultiplier * this.random.range(0.8, 1.3);
        }
        updateZombies(this, dt);

        if (this.elapsed >= this.config.duration || (!this.zombies.some(activeZombie) && !this.zombies.some(z => z.teleport))) this.finish();
    }
}
