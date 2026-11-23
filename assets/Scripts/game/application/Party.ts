import type { Zombie } from '../domain/Model';

export interface PartyMember { id: number; kind: number; growth: number }

export interface FallenEntry { member: PartyMember; revived: boolean }

export interface RoundOutcome {
    won: boolean;
    delivered: PartyMember[];
    fallen: FallenEntry[];
}

export type StoredMember = Omit<PartyMember, 'id'> & { id?: number };

export const MAX_PARTY = 200;
export const MAX_COLLECTION = 500;

export const SELL_PRICE_STEP = 80;

export function sellPrice(growth: number, step = SELL_PRICE_STEP): number {
    const g = Number.isFinite(growth) ? Math.max(0, Math.floor(growth)) : 0;
    const s = Number.isFinite(step) ? Math.max(0, Math.floor(step)) : SELL_PRICE_STEP;
    return s * (g + 1);
}

export function normalizeKind(kind: number, kindCount: number): number {
    const kinds = Math.max(1, Math.floor(kindCount) || 1);
    return ((kind % kinds) + kinds) % kinds;
}

export function makeLineup(party: readonly PartyMember[], limit: number, kindCount: number): PartyMember[] {
    return party.slice(0, Math.max(0, Math.floor(limit))).map(m => ({ id: m.id, kind: normalizeKind(m.kind, kindCount), growth: m.growth }));
}

export function settleParty(lineup: readonly PartyMember[], zombies: readonly Pick<Zombie, 'state'>[], party: readonly PartyMember[], won: boolean, revivalEnabled = true, preLevelEnabled = true): { party: PartyMember[]; outcome: RoundOutcome } {
    const delivered: PartyMember[] = [], kept: PartyMember[] = [];
    const fallen: FallenEntry[] = [];
    lineup.forEach((member, i) => {
        const state = zombies[i]?.state;
        if (state === 'saved') delivered.push({ ...member, growth: member.growth + 1 });
        else if (state === 'dead' && revivalEnabled && preLevelEnabled) fallen.push({ member: { ...member }, revived: false });
        else kept.push({ ...member });
    });
    const used = new Set(lineup.map(m => m.id));
    const rest = party.filter(m => !used.has(m.id)).map(m => ({ ...m }));
    return { party: [...delivered.map(m => ({ ...m })), ...kept, ...rest].slice(0, MAX_PARTY), outcome: { won, delivered, fallen } };
}

export function parseMembers(value: unknown, max: number): StoredMember[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value
        .filter((m): m is StoredMember => !!m && typeof m === 'object'
            && Number.isSafeInteger((m as StoredMember).kind) && (m as StoredMember).kind >= 0
            && Number.isSafeInteger((m as StoredMember).growth) && (m as StoredMember).growth >= 0)
        .slice(0, max)
        .map(m => (Number.isSafeInteger(m.id) && m.id! > 0 ? { id: m.id, kind: m.kind, growth: m.growth } : { kind: m.kind, growth: m.growth }));
}

export function parseParty(value: unknown): StoredMember[] | undefined {
    return parseMembers(value, MAX_PARTY);
}
