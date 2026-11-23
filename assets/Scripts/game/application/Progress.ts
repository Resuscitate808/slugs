import { RoundResult } from '../domain/Model';
import { MAX_COLLECTION, PartyMember, StoredMember, parseMembers, parseParty } from './Party';
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type BoosterKind = 'slow' | 'teleport';
export type Boosters = Record<BoosterKind, number>;

export const STARTING_BOOSTERS: Readonly<Boosters> = { slow: 1, teleport: 1 };
export const STARTING_EGGS = 2;

export interface ProgressData {
    version: 1; coins: number; unlockedLevel: number; best: Record<string, number>; generatorClaimedAt?: number;
    party?: PartyMember[]; collection?: PartyMember[]; nextMemberId?: number; boosters: Boosters; eggs?: number;
    rosterGranted?: number;
}
export class Progress {
    data: ProgressData = { version: 1, coins: 0, unlockedLevel: 1, best: {}, boosters: { ...STARTING_BOOSTERS }, eggs: STARTING_EGGS };
    available = true;
    private settled = new Set<string>();
    constructor(private storage: StoragePort, private key = 'zombie-road.progress.v1') {
        try {
            const raw = storage.getItem(key);
            if (!raw) return;
            const value: unknown = JSON.parse(raw);
            if (!value || typeof value !== 'object') return;
            const d = value as ProgressData;
            if (d.version !== 1 || !Number.isSafeInteger(d.coins) || d.coins < 0 || !Number.isSafeInteger(d.unlockedLevel) || d.unlockedLevel < 1) return;
            const best: Record<string, number> = {};
            if (d.best && typeof d.best === 'object') for (const [level, stars] of Object.entries(d.best)) {
                if (/^[1-9]\d*$/.test(level) && [0, 1, 2, 3, 5].includes(stars)) best[level] = stars;
            }
            const boosters: Boosters = { ...STARTING_BOOSTERS };
            if (d.boosters && typeof d.boosters === 'object') for (const kind of Object.keys(boosters) as BoosterKind[]) {
                const n = (d.boosters as Partial<Boosters>)[kind];
                if (Number.isSafeInteger(n) && n! >= 0) boosters[kind] = n!;
            }
            const eggs = Number.isSafeInteger(d.eggs) && d.eggs! >= 0 ? d.eggs! : STARTING_EGGS;
            this.data = { version: 1, coins: d.coins, unlockedLevel: d.unlockedLevel, best, boosters, eggs };
            if (Number.isSafeInteger(d.generatorClaimedAt) && d.generatorClaimedAt! >= 0) this.data.generatorClaimedAt = d.generatorClaimedAt;
            const party = parseParty(d.party);
            const collection = parseMembers(d.collection, MAX_COLLECTION);
            this.adoptMembers(party, collection, d.nextMemberId);
            if (Number.isSafeInteger(d.rosterGranted) && d.rosterGranted! >= 0 && d.rosterGranted! <= 200) this.data.rosterGranted = d.rosterGranted;
        } catch { this.available = false; }
    }
    reset(): void {
        this.data = { version: 1, coins: 0, unlockedLevel: 1, best: {}, boosters: { ...STARTING_BOOSTERS }, eggs: STARTING_EGGS };
        this.settled.clear();
        this.save();
    }
    get party(): PartyMember[] { return this.data.party ?? []; }
    get collection(): PartyMember[] { return this.data.collection ?? []; }

    createMember(kind: number, growth = 0): PartyMember {
        const id = this.data.nextMemberId ?? 1;
        this.data.nextMemberId = id + 1;
        return { id, kind, growth };
    }

    private adoptMembers(party: StoredMember[] | undefined, collection: StoredMember[] | undefined, next: unknown): void {
        const all = [...(party ?? []), ...(collection ?? [])];
        let nextId = Number.isSafeInteger(next) && (next as number) > 0 ? next as number : 1;
        for (const m of all) if (m.id !== undefined && m.id >= nextId) nextId = m.id + 1;
        const seen = new Set<number>();
        const assign = (m: StoredMember): PartyMember => {
            let id = m.id;
            if (id === undefined || seen.has(id)) id = nextId++;
            seen.add(id);
            return { id, kind: m.kind, growth: m.growth };
        };
        if (party) this.data.party = party.map(assign);
        if (collection) this.data.collection = collection.map(assign);
        this.data.nextMemberId = nextId;
    }

    onInsufficientCoins: ((required: number, available: number) => void) | null = null;

    spendCoins(cost: number): boolean {
        if (!Number.isSafeInteger(cost) || cost < 0) return false;
        if (this.data.coins < cost) {
            this.onInsufficientCoins?.(cost, this.data.coins);
            return false;
        }
        this.data.coins -= cost;
        return true;
    }

    get eggs(): number { return this.data.eggs ?? STARTING_EGGS; }

    addEggs(amount = 1): void {
        if (!Number.isSafeInteger(amount) || amount <= 0) return;
        this.data.eggs = this.eggs + amount;
        this.save();
    }

    boosterCount(kind: BoosterKind): number { return this.data.boosters?.[kind] ?? 0; }

    spendBooster(kind: BoosterKind): boolean {
        if (this.boosterCount(kind) <= 0) return false;
        this.data.boosters[kind]--;
        this.save();
        return true;
    }

    addBooster(kind: BoosterKind, amount = 1): void {
        if (!Number.isSafeInteger(amount) || amount <= 0) return;
        this.data.boosters[kind] = this.boosterCount(kind) + amount;
        this.save();
    }
    settle(roundId: string, level: number, result: RoundResult): boolean {
        if (this.settled.has(roundId)) { if (!this.available) this.save(); return false; }
        this.settled.add(roundId);
        this.data.coins += result.coins;
        this.data.eggs = this.eggs + 1;
        this.data.best[String(level)] = Math.max(this.data.best[String(level)] ?? 0, result.stars);
        if (result.won) this.data.unlockedLevel = Math.max(this.data.unlockedLevel, level + 1);
        this.save();
        return true;
    }
    save(): void {
        try { this.storage.setItem(this.key, JSON.stringify(this.data)); this.available = true; }
        catch { this.available = false; }
    }
}
