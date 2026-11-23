import { defaultLaneDirections } from './LevelCatalog';
import type { LevelDefinition, RoadObstacle } from './LevelCatalog';

export type Point = { x: number; z: number };
export type ZombieState = 'idle' | 'walking' | 'stuck' | 'fallen' | 'eating' | 'dead' | 'saved' | 'lost';
export type VehicleKind = 'ordinary' | 'jeep' | 'pink';
export type Axis = 'x' | 'z';
export interface Zombie extends Point {
    id: number;
    state: ZombieState;
    direction: Point;
    goalX: number;

    savedTarget?: Point;
    aimHeld?: boolean;
    idleMotion?: import('./IdleMovement').IdleMotion;
    flight?: { direction: Point; remaining: number; speed: number };

    teleport?: { from: Point; elapsed: number; duration: number };

    vehicleDetour?: { side: number };
    disoriented: number;
    speed: number;
    timer: number;
    immunity: number;
    wander: number;
    boost: number;
    ditchMask: number;
    visited: Set<number>;
    visitedObstacles: Set<string>;
}
export interface VehicleBounds { halfX: number; halfZ: number; offsetX: number; offsetZ: number }
export type VehicleShapes = Record<'xPositive' | 'xNegative' | 'zPositive' | 'zNegative', VehicleBounds>;
export interface Vehicle extends Point {
    shapes?: VehicleShapes;
    overtake?: { home: number; passing: number; leaderId: number; returning: boolean };
    id: number;
    kind: VehicleKind;
    axis: Axis;
    lane: number;
    targetLane: number;
    direction: number;
    speed: number;
    cruise: number;
    stopped: number;
    reaction: number;
    hits: number;
    driverCreated: boolean;
    abandoned: boolean;
    collisionCooldown: number;
}
export interface Remains extends Point { id: number; source: number; bloodRadius: number }
export interface Driver extends Point { id: number; carId: number; time: number; bitten: boolean; eaten: boolean }
export interface Bush extends Point { radius: number }
export interface Modifiers {
    slipMultiplier: number;
    snagMultiplier: number;
    jeepDetectionMultiplier: number;
    speedMultiplier: number;
}
export interface GameConfig {
    levelTable?: boolean;
    unitsPerPixel?: number;
    depthPerPixel?: number;
    flightSpeedPixels?: number;
    flightMinPixels?: number;
    flightMaxPixels?: number;
    queueGap?: number;
    spawnPauses?: number[];
    zombieCount: number;
    spawnOffsetZ: number;
    finishOffsetZ: number;
    laneOffsetZ: number;
    vehicleOffsetZ: number;
    vehicleShapes: Partial<Record<VehicleKind, VehicleShapes>>;
    vehicleProfiles?: Partial<Record<VehicleKind, { speed: number; firstLevel: number; weight: number }>>;
    laneWidths: number[];
    duration: number;
    zombieSpeed: number;
    trafficInterval: number;
    bushChance: number;
    ditchSlipChance: number;
    bloodSlipChance: number;

    obstaclesVisible?: boolean;
    obstaclesEnabled: boolean;
    driverExitEnabled: boolean;
    driverExitChance: number;
    fallDuration: number;
    eatDuration: number;
    driverInspectDuration: number;
    maxVehicles: number;
}
export interface LevelLayout {
    level: number;
    halfWidth: number;
    spawnZ: number;
    finishZ: number;
    laneWidth: number;
    laneCenters: number[];
    laneDirections: number[];
    roadHalf: number;
    bushZ: number;
    ditchEdges: number[];
    bushes: Bush[];
    obstacles: RoadObstacle[];
}
export interface RoundResult { saved: number; total: number; stars: number; coins: number; won: boolean }
export interface GameEvent { type: 'launched' | 'freed' | 'fall' | 'hit' | 'saved' | 'crash' | 'driver' | 'finished' | 'slowed' | 'teleported'; id: number }
export const DEFAULT_CONFIG: Readonly<GameConfig> = {

    spawnOffsetZ: 3,

    finishOffsetZ: 1,
    laneWidths: [1.8, 1.8, 1.8, 1.8, 1.8],
    laneOffsetZ: 0,
    vehicleOffsetZ: 0.4,
    vehicleShapes: {},
    zombieCount: 20, duration: 180, zombieSpeed: 0.72, trafficInterval: 2.1,
    bushChance: 0.28, ditchSlipChance: 0.28, bloodSlipChance: 0.5,
    obstaclesEnabled: true,
    driverExitEnabled: true, driverExitChance: 0.25, fallDuration: 1.8,
    eatDuration: 8, driverInspectDuration: 30, maxVehicles: 24,
};
export const DEFAULT_MODIFIERS: Readonly<Modifiers> = {
    slipMultiplier: 1, snagMultiplier: 1, jeepDetectionMultiplier: 1, speedMultiplier: 1,
};
export class Random {
    constructor(private state: number) { this.state = (state >>> 0) || 1; }
    next(): number {
        let x = this.state;
        x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
        this.state = x >>> 0;
        return this.state / 4294967296;
    }
    range(min: number, max: number): number { return min + (max - min) * this.next(); }
    chance(value: number): boolean { return this.next() < Math.max(0, Math.min(1, value)); }
    direction(): Point { const a = this.range(0, Math.PI * 2); return { x: Math.cos(a), z: Math.sin(a) }; }
}
export function distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.z - b.z); }
export function normalize(x: number, z: number): Point {
    const length = Math.hypot(x, z);
    return length > 0.0001 ? { x: x / length, z: z / length } : { x: 0, z: -1 };
}
export function activeZombie(z: Zombie): boolean { return !['dead', 'saved', 'lost'].includes(z.state); }
export function onRoad(z: Point, layout: LevelLayout): boolean {
    return Math.abs(z.z) < layout.roadHalf;
}
export function createLayout(level: number, definition?: LevelDefinition, laneWidth = DEFAULT_CONFIG.laneWidths[level - 1] ?? 1.8, laneOffsetZ = DEFAULT_CONFIG.laneOffsetZ): LevelLayout {
    laneOffsetZ = Number.isFinite(laneOffsetZ) ? laneOffsetZ : DEFAULT_CONFIG.laneOffsetZ;

    laneWidth = Number.isFinite(laneWidth) ? Math.max(1.4, laneWidth) : (DEFAULT_CONFIG.laneWidths[level - 1] ?? 1.8);
    if (definition && definition.id !== level) throw new Error('Level definition does not match requested level');
    const laneDirections = (definition?.laneDirections ?? defaultLaneDirections(level)).map(d => d === 'right' ? 1 : -1);
    const roadHalf = Math.max(3.6, laneWidth * laneDirections.length / 2);

    const laneCenters = laneDirections.map((_, i) => laneOffsetZ + (i - (laneDirections.length - 1) / 2) * laneWidth);
    return {
        level, halfWidth: 15, spawnZ: 10.5, finishZ: -6.2, laneWidth, laneCenters, laneDirections,

        roadHalf, bushZ: 7.5, ditchEdges: [6.6, 5.1],
        bushes: [], obstacles: definition?.obstacles.map(o => ({ ...o })) ?? [],
    };
}
export function score(saved: number, total: number): RoundResult {
    const ratio = total > 0 ? saved / total : 0;
    const stars = ratio === 1 ? 5 : ratio > 0.75 ? 3 : ratio > 0.5 ? 2 : ratio >= 0.25 ? 1 : 0;
    return { saved, total, stars, coins: saved * stars, won: stars > 0 };
}
