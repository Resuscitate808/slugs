import { levelTitle, type LevelCatalog } from '../domain/LevelCatalog';
import { DEFAULT_CONFIG, GameConfig } from '../domain/Model';
import { levelRule } from '../domain/LevelRules';
import { World } from '../domain/World';
import { Progress } from './Progress';
import { MAX_COLLECTION, MAX_PARTY, PartyMember, RoundOutcome, makeLineup, settleParty } from './Party';

export type GameScreen = 'levels' | 'prelevel' | 'playing' | 'paused' | 'result' | 'complete';
export const TEST_LEVELS = [1, 2, 3, 4, 5] as const;

export class GameFlow {
    preLevelEnabled = true;
    screen: GameScreen = 'levels';
    selectedLevel: number;
    world: World;

    lineup: PartyMember[] = [];

    outcome: RoundOutcome | null = null;

    teleportArmed = false;
    resultIntro = false;
    revivalEnabled = true;
    private round = 0;
    private readonly session = `${Date.now()}-${Math.random()}`;

    constructor(readonly progress: Progress, private config: Partial<GameConfig>, private seed = 0, startingLevel = 1, private catalog?: LevelCatalog, private kindCount = 1) {
        this.selectedLevel = Number.isInteger(startingLevel) ? Math.max(1, Math.min(5, startingLevel)) : 1;
        this.ensureRoster();
        this.world = this.createWorld();
        this.world.paused = true;
    }
    resetProgress(): void {
        this.world.paused = true;
        this.progress.reset();
        this.resultIntro = false;
        this.selectedLevel = 1;
        this.screen = 'levels';
        this.outcome = null;
        this.teleportArmed = false;
        this.ensureRoster();
        this.world = this.createWorld();
        this.world.paused = true;
    }
    get target(): number { return this.config.levelTable ? levelRule(this.selectedLevel).target : Math.ceil(this.world.zombies.length / 4); }

    get partyLimit(): number {
        if (this.config.levelTable) return levelRule(this.selectedLevel).total;
        const count = Number.isFinite(this.config.zombieCount) ? this.config.zombieCount! : DEFAULT_CONFIG.zombieCount;
        return Math.max(1, Math.min(100, MAX_PARTY, Math.round(count)));
    }
    get partyFull(): boolean { return this.progress.party.length >= this.partyLimit; }

    select(level: number): void {
        if (this.screen === 'levels' && TEST_LEVELS.some(value => value === level)
            && level <= Math.max(1, Math.min(TEST_LEVELS.length, this.progress.data.unlockedLevel)))
            this.selectedLevel = level;
    }

    prepare(): boolean {
        if (this.screen !== 'levels') return false;
        this.openPreLevel();
        return true;
    }
    start(): boolean {
        if (!['levels', 'prelevel', 'paused', 'result'].includes(this.screen)) return false;
        if (!this.progress.available) this.progress.save();
        this.closeResult();
        const world = this.createWorld();
        if (world.zombies.length === 0) { this.openPreLevel(); return false; }
        this.world = world;
        this.outcome = null;
        this.teleportArmed = false;
        this.round++;
        this.screen = 'playing';
        return true;
    }

    useSlow(duration: number, factor: number): boolean {
        if (this.screen !== 'playing' || this.world.slowTime > 0 || this.progress.boosterCount('slow') <= 0) return false;
        if (!this.world.slowTraffic(duration, factor)) return false;
        this.progress.spendBooster('slow');
        return true;
    }

    armTeleport(): boolean {
        if (this.teleportArmed) { this.teleportArmed = false; return false; }
        if (this.screen !== 'playing' || this.progress.boosterCount('teleport') <= 0) return false;
        this.teleportArmed = true;
        return true;
    }
    cancelTeleport(): void { this.teleportArmed = false; }

    teleport(id: number, duration: number): boolean {
        if (!this.teleportArmed || this.screen !== 'playing' || this.progress.boosterCount('teleport') <= 0) return false;
        if (!this.world.teleport(id, duration)) return false;
        this.teleportArmed = false;
        this.progress.spendBooster('teleport');
        return true;
    }
    togglePause(): void {
        this.teleportArmed = false;
        if (this.screen === 'playing') this.screen = 'paused';
        else if (this.screen === 'paused') this.screen = 'playing';
        this.world.paused = this.screen !== 'playing';
    }
    pause(): void { if (this.screen === 'playing') this.togglePause(); }
    levels(): void { this.closeResult(); this.screen = 'levels'; this.outcome = null; this.teleportArmed = false; this.world.paused = true; }

    advance(): boolean {
        if (this.screen !== 'result' || !this.world.result) return false;
        const won = this.world.result.won;
        this.closeResult();
        if (won) {
            if (this.selectedLevel === 5) { this.screen = 'complete'; return false; }
            this.selectedLevel++;
        }
        if (this.preLevelEnabled) this.openPreLevel();
        else {
            this.world = this.createWorld();
            this.world.paused = true;
            this.outcome = null;
            this.teleportArmed = false;
            this.screen = 'levels';
        }
        return true;
    }

    revive(index: number, cost: number): boolean {
        const entry = this.revivalEnabled && this.screen === 'result' ? this.outcome?.fallen[index] : undefined;
        if (!entry || entry.revived || !this.progress.spendCoins(cost)) return false;
        entry.revived = true;
        this.progress.data.party = [...this.progress.party, { ...entry.member }];
        this.progress.save();
        return true;
    }

    storeMember(id: number): boolean {
        if (this.screen !== 'prelevel' && this.screen !== 'result') return false;
        const member = this.progress.party.find(m => m.id === id);
        if (!member || this.progress.collection.length >= MAX_COLLECTION) return false;
        this.progress.data.party = this.progress.party.filter(m => m.id !== id);
        this.progress.data.collection = [...this.progress.collection, { ...member }];
        this.progress.save();
        if (this.screen === 'prelevel') this.openPreLevel();
        return true;
    }

    sellMember(id: number, price: number): boolean {
        if (this.screen !== 'prelevel' && this.screen !== 'result') return false;
        if (!Number.isSafeInteger(price) || price < 0) return false;
        const member = this.progress.party.find(m => m.id === id);
        if (!member) return false;
        this.progress.data.party = this.progress.party.filter(m => m.id !== id);
        this.progress.data.coins += price;
        this.progress.save();
        if (this.screen === 'prelevel') this.openPreLevel();
        return true;
    }

    hatchEgg(random: () => number = Math.random): PartyMember | null {
        if (this.screen !== 'prelevel' || this.progress.eggs <= 0 || this.progress.collection.length >= MAX_COLLECTION) return null;
        const kinds = Math.max(1, Math.floor(this.kindCount) || 1);
        const roll = random();
        const kind = Math.min(kinds - 1, Math.max(0, Math.floor((Number.isFinite(roll) ? roll : 0) * kinds)));
        const member = this.progress.createMember(kind, 0);
        this.progress.data.eggs = this.progress.eggs - 1;
        this.progress.data.collection = [...this.progress.collection, member];
        this.progress.save();
        return { ...member };
    }

    takeFromCollection(id: number, replaceId?: number): boolean {
        if (this.screen !== 'prelevel') return false;
        const member = this.progress.collection.find(m => m.id === id);
        if (!member) return false;
        let party = this.progress.party;
        let collection = this.progress.collection.filter(m => m.id !== id);
        if (party.length < this.partyLimit) party = [...party, { ...member }];
        else {
            const index = replaceId === undefined ? -1 : party.findIndex(m => m.id === replaceId);
            if (index < 0) return false;
            collection = [...collection, { ...party[index] }];
            party = party.map((m, i) => i === index ? { ...member } : m);
        }
        this.progress.data.party = party;
        this.progress.data.collection = collection;
        this.progress.save();
        this.openPreLevel();
        return true;
    }

    update(dt: number): void {
        if (this.screen !== 'playing') return;
        this.world.update(dt);
        if (!this.world.result) return;
        const settled = settleParty(this.lineup, this.world.zombies, this.progress.party, this.world.result.won, this.revivalEnabled, this.preLevelEnabled);
        this.progress.data.party = settled.party;
        this.outcome = settled.outcome;
        this.progress.settle(`${this.session}-${this.round}`, this.selectedLevel, this.world.result);
        this.world.paused = true;
        this.teleportArmed = false;
        this.resultIntro = true;
        this.screen = 'result';
    }
    showPostLevel(): boolean {
        if (!this.revivalEnabled || this.screen !== 'result' || !this.resultIntro) return false;
        this.resultIntro = false;
        return true;
    }
    get levelName(): string { return levelTitle(this.selectedLevel); }

    private closeResult(): void {
        this.resultIntro = false;
        const outcome = this.outcome;
        if (this.screen !== 'result' || !outcome) return;
        this.outcome = null;

    }

    private ensureRoster(): void {
        if (this.progress.data.collection) return;
        const party = [...this.progress.party];
        const kinds = Math.max(1, Math.floor(this.kindCount) || 1);
        for (let i = party.length; i < this.partyLimit; i++) party.push(this.progress.createMember(i % kinds));
        this.progress.data.party = party.slice(0, this.partyLimit);
        this.progress.data.collection = party.slice(this.partyLimit).slice(0, MAX_COLLECTION);
        if (this.config.levelTable) this.progress.data.rosterGranted = this.partyLimit;
        this.progress.save();
    }
    private openPreLevel(): void {
        this.world = this.createWorld();
        this.world.paused = true;
        this.outcome = null;
        this.screen = 'prelevel';
    }
    private grantRosterExpansion(): void {
        if (!this.config.levelTable) return;
        const data = this.progress.data;
        if (this.progress.party.length < this.partyLimit) {
            const kinds = Math.max(1, Math.floor(this.kindCount) || 1);
            for (let i = this.progress.party.length; i < this.partyLimit; i++) {
                this.progress.party.push(this.progress.createMember(i % kinds));
            }
        }
        const granted = Math.max(data.rosterGranted ?? 0, this.progress.party.length);
        if (data.rosterGranted !== granted) {
            data.rosterGranted = granted;
            this.progress.save();
        }
    }
    private createWorld(): World {
        this.grantRosterExpansion();
        if (this.config.levelTable && this.progress.party.length > this.partyLimit) {
            const room = Math.max(0, MAX_COLLECTION - this.progress.collection.length);
            const extras = this.progress.party.slice(this.partyLimit, this.partyLimit + room);
            if (extras.length) {
                const moved = new Set(extras.map(m => m.id));
                this.progress.data.party = this.progress.party.filter(m => !moved.has(m.id));
                this.progress.data.collection = [...this.progress.collection, ...extras];
                this.progress.save();
            }
        }
        const definition = this.catalog?.levels.find(l => l.id === this.selectedLevel);
        if (this.catalog && !definition) throw new Error(`Missing level ${this.selectedLevel}`);
        const lineup = makeLineup(this.progress.party, this.partyLimit, this.kindCount);
        const world = new World(this.selectedLevel, this.seed || Date.now(), { ...this.config, zombieCount: lineup.length }, {}, definition);
        this.lineup = lineup;
        return world;
    }
}
