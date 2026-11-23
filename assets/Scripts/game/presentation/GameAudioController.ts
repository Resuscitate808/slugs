import { _decorator, AudioClip, AudioSource, Button, CCFloat, Component, Game, game, Node, sys } from 'cc';
import { GameSettings } from './GameSettings';
import type { GameEvent, VehicleKind } from '../domain/Model';
import { vehicleCenter, vehicleExtent } from '../domain/VehicleContact';
import type { World } from '../domain/World';

const { ccclass, property } = _decorator;
const kinds: VehicleKind[] = ['ordinary', 'jeep', 'pink'];
const volume = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
type Engine = { source: AudioSource; running: boolean; owner?: number };
type AudioBounds = { left: number; right: number };

@ccclass('GameAudioController')
export class GameAudioController extends Component {
    @property(AudioClip) musicClip: AudioClip | null = null;
    @property({ type: CCFloat, range: [0, 1, 0.01], slide: true }) musicVolume = 0.5;
    @property(AudioClip) buttonClip: AudioClip | null = null;
    @property({ type: CCFloat, range: [0, 1, 0.01], slide: true }) buttonVolume = 1;
    @property(AudioClip) hitClip: AudioClip | null = null;
    @property({ type: CCFloat, range: [0, 1, 0.01], slide: true }) hitVolume = 1;
    @property(GameSettings) settings: GameSettings | null = null;
    @property(Node) buttonRoot: Node | null = null;

    private music: AudioSource | null = null;
    private effects: AudioSource | null = null;
    private engines = new Map<VehicleKind, Engine>();
    private buttons: Button[] = [];
    private positions = new Map<number, { x: number; z: number }>();
    private visibleOrder = new Map<number, number>();
    private arrival = 0;
    private sampledWorld: World | null = null;
    private sampledTime = -1;
    private hidden = false;
    private musicOn = true;
    private effectsOn = true;
    get soundEnabled(): boolean { return this.musicOn && this.effectsOn; }
    get musicEnabled(): boolean { return this.musicOn; }
    get effectsEnabled(): boolean { return this.effectsOn; }

    setMusicEnabled(enabled: boolean): void {
        this.musicOn = enabled;
        this.saveAudioSetting('zombie-road-music', enabled);
        if (enabled && this.enabledInHierarchy) this.startMusic();
        else this.music?.stop();
    }

    setEffectsEnabled(enabled: boolean): void {
        this.effectsOn = enabled;
        this.saveAudioSetting('zombie-road-effects', enabled);
        if (!enabled) {
            this.effects?.stop();
            this.resetTraffic();
        }
    }

    setSoundEnabled(enabled: boolean): void {
        this.setMusicEnabled(enabled);
        this.setEffectsEnabled(enabled);
    }

    protected onLoad(): void {
        try {
            const legacy = sys.localStorage.getItem('zombie-road-sound');
            this.musicOn = this.readAudioSetting('zombie-road-music', legacy);
            this.effectsOn = this.readAudioSetting('zombie-road-effects', legacy);
        } catch {}
        this.music = this.createSource();
        this.effects = this.createSource();
        for (const kind of kinds) this.engines.set(kind, { source: this.createSource(), running: false });
    }

    protected onEnable(): void {
        this.buttons = (this.buttonRoot ?? this.node.scene).getComponentsInChildren(Button);
        for (const button of this.buttons) button.node.on(Button.EventType.CLICK, this.onButton, this);
        game.on(Game.EVENT_HIDE, this.onHide, this);
        game.on(Game.EVENT_SHOW, this.onShow, this);
        this.hidden = false;
        this.startMusic();
    }

    protected onDisable(): void {
        for (const button of this.buttons) button.node.off(Button.EventType.CLICK, this.onButton, this);
        this.buttons = [];
        game.off(Game.EVENT_HIDE, this.onHide, this);
        game.off(Game.EVENT_SHOW, this.onShow, this);
        this.music?.stop();
        this.resetTraffic();
    }

    protected onDestroy(): void {
        this.music?.destroy();
        this.effects?.destroy();
        for (const engine of this.engines.values()) engine.source.destroy();
        this.engines.clear();
    }

    handleEvent(event: GameEvent): void {
        if (event.type === 'hit') this.playEffect(this.hitClip, this.hitVolume);
    }

    sync(world: World, playing: boolean, bounds: AudioBounds = { left: -world.layout.halfWidth, right: world.layout.halfWidth }): void {
        if (!this.effectsOn || !this.enabledInHierarchy || this.hidden || !playing || world.paused || world.result) {
            this.resetTraffic();
            return;
        }
        if (this.sampledWorld !== world) {
            this.resetTraffic();
            this.sampledWorld = world;
        }
        if (this.sampledTime === world.elapsed) return;
        const dt = this.sampledTime < 0 ? 0 : Math.max(0, world.elapsed - this.sampledTime);
        this.sampledTime = world.elapsed;
        const moving = new Set<number>();
        const visible = world.vehicles.filter(car => vehicleCenter(car, 'x') + vehicleExtent(car, 'x') > bounds.left
            && vehicleCenter(car, 'x') - vehicleExtent(car, 'x') < bounds.right);
        const visibleIds = new Set(visible.map(car => car.id));
        for (const id of this.visibleOrder.keys()) if (!visibleIds.has(id)) this.visibleOrder.delete(id);
        for (const car of visible) if (!this.visibleOrder.has(car.id)) this.visibleOrder.set(car.id, this.arrival++);
        const positions = new Map<number, { x: number; z: number }>();
        for (const car of world.vehicles) {
            const previous = this.positions.get(car.id);
            if (previous && !car.abandoned && car.stopped <= 0
                && Math.hypot(car.x - previous.x, car.z - previous.z) > 0.00001) moving.add(car.id);
            positions.set(car.id, { x: car.x, z: car.z });
        }
        this.positions = positions;
        for (const kind of kinds) {
            const sound = this.settings?.soundFor(kind);
            const engine = this.engines.get(kind);
            if (!engine) continue;
            const candidates = visible.filter(car => car.kind === kind);
            const owner = candidates.find(car => car.id === engine.owner)
                ?? candidates.sort((a, b) => this.visibleOrder.get(a.id)! - this.visibleOrder.get(b.id)!)[0];
            if (engine.owner !== owner?.id) {
                this.stopEngine(engine);
                engine.source.volume = 0;
                engine.owner = owner?.id;
            }
            const remaining = owner ? owner.direction > 0
                ? bounds.right - vehicleCenter(owner, 'x') + vehicleExtent(owner, 'x')
                : vehicleCenter(owner, 'x') + vehicleExtent(owner, 'x') - bounds.left : 0;
            const edge = Math.max(0, Math.min(1, remaining / 4));
            const gain = volume(sound?.volume ?? 0) * edge * edge * (3 - 2 * edge);
            if (!owner || !moving.has(owner.id) || !sound?.clip || gain === 0) {
                this.stopEngine(engine);
                continue;
            }
            if (engine.source.clip !== sound.clip) {
                this.stopEngine(engine);
                engine.source.clip = sound.clip;
            }
            engine.source.volume = Math.min(gain, engine.source.volume + volume(sound.volume) * dt / 0.25);
            if (!engine.running) {
                engine.source.loop = true;
                engine.source.play();
                engine.running = true;
            }
        }
    }

    private createSource(): AudioSource {
        const source = this.node.addComponent(AudioSource);
        source.playOnAwake = false;
        return source;
    }

    private startMusic(): void {
        if (!this.musicOn || !this.music || !this.musicClip || this.hidden) return;
        this.music.clip = this.musicClip;
        this.music.loop = true;
        this.music.volume = volume(this.musicVolume);
        this.music.play();
    }

    private playEffect(clip: AudioClip | null, gain: number): void {
        if (!this.effectsOn || !this.enabledInHierarchy || this.hidden || !clip || volume(gain) === 0 || !this.effects) return;
        this.effects.stop();
        this.effects.clip = clip;
        this.effects.volume = volume(gain);
        this.effects.play();
    }

    private onButton(): void { this.playEffect(this.buttonClip, this.buttonVolume); }

    private stopEngine(engine: Engine): void {
        if (engine.running) engine.source.stop();
        engine.running = false;
    }

    private resetTraffic(): void {
        for (const engine of this.engines.values()) {
            this.stopEngine(engine);
            engine.owner = undefined;
            engine.source.volume = 0;
        }
        this.visibleOrder.clear();
        this.arrival = 0;
        this.positions.clear();
        this.sampledWorld = null;
        this.sampledTime = -1;
    }

    private onHide(): void {
        this.hidden = true;
        this.music?.pause();
        this.resetTraffic();
    }

    private onShow(): void {
        this.hidden = false;
        this.startMusic();
    }

    private readAudioSetting(key: string, legacy: string | null): boolean {
        const value = sys.localStorage.getItem(key);
        return value !== null ? value !== 'off' : legacy !== 'off';
    }

    private saveAudioSetting(key: string, enabled: boolean): void {
        try { sys.localStorage.setItem(key, enabled ? 'on' : 'off'); } catch {}
    }
}
