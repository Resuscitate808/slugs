import { Progress } from './Progress';

export interface GeneratorRewardRules { coins: number; intervalHours: number }

export class GeneratorReward {
    readonly coins: number;
    readonly intervalMs: number;
    constructor(private readonly progress: Progress, rules: GeneratorRewardRules) {
        this.coins = Number.isFinite(rules.coins) ? Math.max(0, Math.floor(rules.coins)) : 0;
        const hours = Number.isFinite(rules.intervalHours) && rules.intervalHours > 0 ? rules.intervalHours : 6;
        this.intervalMs = Math.round(hours * 3600 * 1000);
    }

    remaining(now: number): number {
        const last = this.progress.data.generatorClaimedAt;
        if (last === undefined) return 0;
        if (last > now) {

            this.progress.data.generatorClaimedAt = now;
            this.progress.save();
            return this.intervalMs;
        }
        return Math.max(0, last + this.intervalMs - now);
    }
    claim(now: number): boolean {
        if (this.remaining(now) > 0) return false;
        this.progress.data.coins += this.coins;
        this.progress.data.generatorClaimedAt = now;
        this.progress.save();
        return true;
    }
}

export function formatCountdown(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}
