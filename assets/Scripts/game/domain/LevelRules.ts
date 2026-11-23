import type { VehicleKind } from './Model';

export interface LevelRule { total: number; target: number; lanes: VehicleKind[]; pauseMin: number; pauseMax: number; entryGap?: number }
export const LEVEL_RULES: readonly LevelRule[] = [
    { total: 4, target: 3, lanes: ['ordinary', 'jeep'], pauseMin: 4, pauseMax: 5 },
    { total: 5, target: 4, lanes: ['ordinary', 'jeep', 'pink'], pauseMin: 3, pauseMax: 4 },
    { total: 6, target: 5, lanes: ['ordinary', 'jeep', 'pink'], pauseMin: 3, pauseMax: 4 },
    { total: 8, target: 6, lanes: ['ordinary', 'jeep', 'pink', 'ordinary'], pauseMin: 5, pauseMax: 7, entryGap: 1.3 },
    { total: 10, target: 7, lanes: ['ordinary', 'jeep', 'pink', 'ordinary', 'jeep'], pauseMin: 3, pauseMax: 4, entryGap: 0.7 },
];
export function levelRule(level: number): LevelRule { return LEVEL_RULES[Math.max(0, Math.min(4, level - 1))]; }
