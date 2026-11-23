import type { Point } from './Model';

export type LaneDirection = 'left' | 'right';

export function defaultLaneDirections(level: number): LaneDirection[] {
    return level <= 2 ? ['left', 'right'] : level === 3 ? ['right', 'left', 'right'] : level === 4 ? ['left', 'right', 'left', 'right'] : ['right', 'left', 'right', 'left', 'right'];
}
export type ObstacleEffect = 'trip' | 'slip' | 'snare';
export interface ObstacleType {
    id: string;
    effect: ObstacleEffect;
    chance: number;
    radius: number;
}
export interface RoadObstacle extends Point {
    id: string;
    type: string;
    rotation: number;
    scale: number;
    radius: number;
    effect: ObstacleEffect;
    chance: number;
}

export function levelTitle(id: number): string { return `Уровень ${String(id).padStart(2, '0')}`; }
export interface LevelDefinition {
    id: number;

    name: string;
    laneDirections: LaneDirection[];
    obstacles: RoadObstacle[];
}
export interface LevelCatalog { version: 1; types: ObstacleType[]; levels: LevelDefinition[] }

function object(value: unknown, path: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: ожидается объект`);
    return value as Record<string, unknown>;
}
function array(value: unknown, path: string, limit: number): unknown[] {
    if (!Array.isArray(value) || value.length > limit) throw new Error(`${path}: ожидается массив, максимум ${limit} элементов`);
    return value;
}
function coordinate(value: unknown, path: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${path}`);
    return value;
}
function number(value: unknown, path: string, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        throw new Error(`${path}: ожидается число от ${min} до ${max}`);
    return value;
}
function text(value: unknown, path: string): string {
    if (typeof value !== 'string' || !value.trim() || value.length > 80) throw new Error(`${path}: нужна строка длиной 1–80`);
    return value;
}
function unique(ids: Array<string | number>, path: string): void {
    if (new Set(ids).size !== ids.length) throw new Error(`${path}: повторяющийся id`);
}

export function parseLevelCatalog(raw: unknown): LevelCatalog {
    const root = object(raw, 'levels');
    if (root.version !== 1) throw new Error('levels.version: поддерживается версия 1');
    const types = array(root.obstacleTypes, 'obstacleTypes', 64).map((entry, i): ObstacleType => {
        const p = `obstacleTypes[${i}]`, t = object(entry, p);
        if (!['trip', 'slip', 'snare'].includes(t.effect as string)) throw new Error(`${p}.effect: нужен trip, slip или snare`);
        return { id: text(t.id, `${p}.id`), effect: t.effect as ObstacleEffect,
            radius: number(t.radius, `${p}.radius`, 0.1, 2), chance: number(t.chance ?? 1, `${p}.chance`, 0, 1) };
    });
    unique(types.map(t => t.id), 'obstacleTypes');
    const levels = array(root.levels, 'levels', 5).map((entry, i): LevelDefinition => {
        const p = `levels[${i}]`, l = object(entry, p);
        const id = number(l.id, `${p}.id`, 1, 5);
        if (!Number.isInteger(id)) throw new Error(`${p}.id: нужен целый номер уровня`);

        const lanes = l.laneDirections === undefined ? defaultLaneDirections(id) : array(l.laneDirections, `${p}.laneDirections`, 5);
        if (lanes.length < 2) throw new Error(`${p}.laneDirections: нужны 2–5 полосы`);
        const laneDirections = lanes.map((direction, j): LaneDirection => {
            if (direction !== 'left' && direction !== 'right') throw new Error(`${p}.laneDirections[${j}]: нужно left или right`);
            return direction;
        });
        const obstacles = array(l.obstacles, `${p}.obstacles`, 128).map((entry, j): RoadObstacle => {
            const q = `${p}.obstacles[${j}]`, o = object(entry, q);
            const type = types.find(t => t.id === o.type);
            if (!type) throw new Error(`${q}.type: неизвестный тип ${String(o.type)}`);
            const scale = number(o.scale ?? 1, `${q}.scale`, 0.1, 4);
            const radius = number(o.radius ?? type.radius * scale, `${q}.radius`, 0.1, 2);
            const x = coordinate(o.x, `${q}.x`);
            const z = coordinate(o.z, `${q}.z`);
            return { id: text(o.id, `${q}.id`), type: type.id, x, z, scale, radius,
                rotation: number(o.rotation ?? 0, `${q}.rotation`, -360, 360), effect: type.effect, chance: type.chance };
        });
        unique(obstacles.map(o => o.id), `${p}.obstacles`);

        return { id, name: levelTitle(id), laneDirections, obstacles };
    });
    unique(levels.map(l => l.id), 'levels');
    if (levels.length !== 5) throw new Error('levels: нужны все пять уровней (id 1–5)');
    return { version: 1, types, levels };
}
