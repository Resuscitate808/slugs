import { _decorator, Component, Node, Camera, Vec3, Color, Layers, sys, game, Game, input, Input, EventKeyboard, KeyCode, resources, JsonAsset, view, ResolutionPolicy } from 'cc';
import { LevelCatalog, parseLevelCatalog } from './domain/LevelCatalog';
import { StartupScreen } from './presentation/StartupScreen';
import { DESIGN_HEIGHT, DESIGN_WIDTH, FitMode, fitMode } from './presentation/ScreenFit';
import { EventBus } from '../../base/controllers/EventBus';
import { World } from './domain/World';
import { Progress } from './application/Progress';
import { GameFlow } from './application/GameFlow';
import { GameSettings } from './presentation/GameSettings';
import { ZombieMovementSettings } from './presentation/ZombieMovementSettings';
import { LevelSettings } from './presentation/LevelSettings';
import { ObstacleSettings } from './presentation/ObstacleSettings';
import { VehicleMovementSettings } from './presentation/VehicleMovementSettings';
import { Primitives } from './presentation/Primitives';
import { WorldView } from './presentation/WorldView';
import { SpriteContacts } from './presentation/SpriteContacts';
import { SlingshotInput } from './presentation/SlingshotInput';
import { GameHud } from './presentation/GameHud';
import { PreLevelWindow } from './presentation/PreLevelWindow';
import { PostLevelWindow } from './presentation/PostLevelWindow';
import { LevelResultWindow } from './presentation/LevelResultWindow';
import { GeneratorReward } from './application/GeneratorReward';
import { PlayingHud } from './presentation/PlayingHud';
import { CollectionWindow } from './presentation/CollectionWindow';
import { EggWindow } from './presentation/EggWindow';
import { EconomyWindows } from './presentation/EconomyWindows';
import { LeaveWarning } from './presentation/LeaveWarning';
import { GameAudioController } from './presentation/GameAudioController';

declare global {
    interface Window {
        setProgressFromCocos?: (value: number) => void;
        stopFakeProgress?: () => void;
        hideLoader?: (onRemoved?: () => void) => void;
        gameViewport?: { refresh?: () => void; resync?: () => void };
    }
}

const { ccclass, requireComponent, property } = _decorator;

@ccclass('GameBootstrap')
@requireComponent(GameSettings)
export class GameBootstrap extends Component {
    readonly events = new EventBus();
    private flow!: GameFlow;
    private progress!: Progress;
    private settings!: GameSettings;
    private visuals!: WorldView;
    private controls!: SlingshotInput;
    private primitives!: Primitives;
    @property(GameHud) hud!: GameHud;
    private runtime!: Node;
    private get world(): World { return this.flow.world; }
    @property(StartupScreen) startup!: StartupScreen;

    @property(PreLevelWindow) preLevel!: PreLevelWindow;
    @property preLevelEnabled = true;

    @property(PostLevelWindow) postLevel!: PostLevelWindow;
    @property(LevelResultWindow) levelComplete!: LevelResultWindow;
    @property(LevelResultWindow) levelFailed!: LevelResultWindow;

    @property(PlayingHud) playingHud!: PlayingHud;

    @property(CollectionWindow) collection: CollectionWindow | null = null;

    @property(EggWindow) egg: EggWindow | null = null;
    @property(GameAudioController) audio: GameAudioController | null = null;
    @property(EconomyWindows) economy: EconomyWindows | null = null;
    @property(LeaveWarning) leaveWarning!: LeaveWarning;
    private resumeAfterEconomy = false;
    private reward!: GeneratorReward;
    private disposed = false;
    private ready = false;
    private resetKeyHeld = false;
    private htmlLoaderHidden = false;
    private fittedCamera: Camera | null = null;

    private appliedFit: FitMode | null = null;
    private appliedFrame = '';
    private fpsFrames = 0;
    private fpsTime = 0;
    private fpsValue = 0;

    private applyScreenFit(): void {
        const frame = view.getFrameSize();
        const mode = fitMode(frame.width, frame.height);
        const signature = `${mode}:${Math.round(frame.width)}x${Math.round(frame.height)}`;
        if (signature === this.appliedFrame) return;
        this.appliedFrame = signature;
        this.appliedFit = mode;
        view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, mode === 'height' ? ResolutionPolicy.FIXED_HEIGHT : ResolutionPolicy.FIXED_WIDTH);
    }

    private fitLandscapeCamera(): void {
        const camera = this.fittedCamera;
        if (!camera || !this.settings.generateEnvironment || !this.settings.useSprites) return;
        const landscape = this.settings.landscapeSprites.find(s => s.level === this.world.layout.level && s.sprite.frame)
            ?? this.settings.landscapeSprites.find(s => s.level === 0 && s.sprite.frame);
        if (!landscape || landscape.sprite.billboard || landscape.sprite.rotation !== 0) return;
        const style = landscape.sprite, frame = style.frame!;
        const depth = style.height || style.width * frame.originalSize.height / Math.max(1, frame.originalSize.width);
        const size = view.getVisibleSize();
        if (size.width <= 0 || size.height <= 0) return;

        const projection = 25 / Math.hypot(25, 24);
        const halfHeight = Math.min(style.width * size.height / size.width / 2, depth * projection / 2);
        if (camera.orthoHeight !== halfHeight) camera.orthoHeight = halfHeight;
        const centerZ = landscape.z + depth / 2 - halfHeight / projection + 0.12 * 24 / 25;
        const position = camera.node.position;
        if (!position || position.x !== landscape.x || position.y !== 25 || position.z !== centerZ + 24)
            camera.node.setPosition(landscape.x, 25, centerZ + 24);
    }
    protected start(): void {
        this.applyScreenFit();
        this.settings = this.getComponent(GameSettings)!;
        if (!this.hud || !this.startup || !this.preLevel || !this.postLevel || !this.playingHud || !this.levelComplete || !this.levelFailed) throw new Error('GameBootstrap: назначьте GameHud, StartupScreen, PreLevelWindow, PostLevelWindow, PlayingHud и оба LevelResultWindow из Canvas сцены');
        window.stopFakeProgress?.();
        this.startup.bind(() => this.loadLevels());
        this.loadLevels();
    }

    private hideHtmlLoader(): void {
        if (this.htmlLoaderHidden) return;
        this.htmlLoaderHidden = true;
        window.setProgressFromCocos?.(100);
        window.hideLoader?.(() => window.gameViewport?.resync?.());
    }
    private loadLevels(): void {
        this.startup?.show('Загрузка уровней…', false);
        const loaded = (error: Error | null, asset?: JsonAsset): void => {
            if (this.disposed) return;
            try {
                if (error || !asset) throw error ?? new Error('Файл уровней не найден');
                const catalog = parseLevelCatalog(asset.json);
                this.initialize(catalog);
                this.startup.hide();
                this.hideHtmlLoader();
            } catch (e) {
                this.ready = false;
                this.controls?.destroy(); this.visuals?.destroy(); this.runtime?.destroy(); this.primitives?.destroy();
                game.off(Game.EVENT_HIDE, this.onHide, this);
                input.off(Input.EventType.KEY_DOWN, this.onKey, this);
                input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
                console.error('[ZombieRoad] Level loading failed', e);
                this.hud.unbind();
                this.preLevel.unbind();
                this.postLevel.unbind();
                this.levelComplete?.unbind();
                this.levelFailed?.unbind();
                this.playingHud.unbind();
                this.startup.show(`Не удалось загрузить уровни\n${e instanceof Error ? e.message : String(e)}\nИсправьте JSON и повторите загрузку.`, true);
                this.hideHtmlLoader();
            }
        };
        if (this.settings.levelCatalog) {
            window.setProgressFromCocos?.(100);
            loaded(null, this.settings.levelCatalog);
        } else {
            resources.load('levels', JsonAsset, (completed, total) => {
                window.setProgressFromCocos?.(total > 0 ? completed / total * 100 : 100);
            }, loaded);
        }
    }
    private initialize(catalog: LevelCatalog): void {
        this.progress = new Progress(sys.localStorage);
        let config = this.getComponent(LevelSettings)?.configure(this.settings.toConfig()) ?? this.settings.toConfig();
        config = this.getComponent(ObstacleSettings)?.configure(config) ?? config;
        this.flow = new GameFlow(this.progress, config, this.settings.seed, this.settings.startingLevel, catalog, this.preLevel.kindCount);
        this.flow.preLevelEnabled = this.preLevelEnabled;
        this.flow.revivalEnabled = this.postLevel.revivalEnabled;
        this.runtime = new Node('ZombieRoadRuntime'); this.runtime.setParent(this.node);
        this.primitives = new Primitives();
        let camera = this.settings.gameCamera;
        if (!camera) {
            const node = new Node('GameCamera'); node.setParent(this.runtime);
            node.setPosition(0, 25, 26); node.lookAt(new Vec3(0, 0, 2));
            camera = node.addComponent(Camera); camera.projection = Camera.ProjectionType.ORTHO;
            camera.orthoHeight = 12; camera.near = 0.1; camera.far = 100;
            camera.clearColor = new Color(238, 229, 203, 255); camera.visibility = Layers.Enum.DEFAULT;
        }
        this.fittedCamera = camera;
        this.visuals = new WorldView(this.runtime, this.settings, this.primitives, camera);

        if (this.settings.useSprites) this.visuals.zombieSkins = this.preLevel.zombieStyles();
        this.controls = new SlingshotInput(camera, () => this.world, this.visuals, () => this.flow.screen === 'playing', {
            armed: () => this.flow.teleportArmed,
            pick: id => { this.flow.teleport(id, this.playingHud.teleportDuration); this.refresh(); },
        });
        this.playingHud.bind({
            slow: () => { this.flow.useSlow(this.playingHud.slowDuration, this.playingHud.slowFactor); this.refresh(); },
            teleport: () => { this.controls.cancel(); this.flow.armTeleport(); this.refresh(); },
        });
        this.hud.bind({
            select: level => {
                if (level > Math.max(1, Math.min(5, this.progress.data.unlockedLevel))) return;
                this.flow.select(level);
                this.prepare();
            },
            play: () => this.prepare(),
            pause: () => this.togglePause(),
            retry: () => this.requestLeave(() => this.begin()),
            levels: () => this.requestLeave(() => { this.controls.cancel(); this.flow.levels(); this.refresh(); }),
            cancel: () => this.controls.cancel(),
        });
        this.reward = new GeneratorReward(this.progress, this.preLevel.rewardRules);
        this.economy?.bind(this.progress, this.reward, () => {
            this.controls.cancel();
            if (this.flow.screen === 'playing') { this.resumeAfterEconomy = true; this.flow.pause(); }
        }, () => {
            if (this.resumeAfterEconomy && this.flow.screen === 'paused') this.flow.togglePause();
            this.resumeAfterEconomy = false;
            this.refresh();
        }, () => this.refresh());
        this.preLevel.bind({
            road: () => this.begin(),
            claim: () => { if (this.reward.claim(Date.now())) this.refresh(); },
            collection: () => { this.collection?.open(); this.refresh(); },
            store: id => { if (this.flow.storeMember(id)) { this.rebuild(); this.refresh(); } },
            eggs: () => {
                if (!this.egg || this.egg.isOpen) return;
                const member = this.flow.hatchEgg();
                if (member) this.egg.show(member);
                this.refresh();
            },
        });
        if (this.egg) {
            this.egg.catalog = this.preLevel;
            this.egg.bind({
                toParty: id => {
                    const done = this.flow.takeFromCollection(id, this.flow.partyFull ? this.preLevel.selectedMemberId : undefined);
                    if (done) { this.rebuild(); this.refresh(); }
                    return done;
                },
            });
        } else console.warn('GameBootstrap: не назначен EggWindow (GameUI/EggPanel)');
        if (this.collection) {
            const collection = this.collection;
            collection.catalog = this.preLevel;
            collection.setCardFrames(this.preLevel.cardFrame, this.preLevel.selectedCardFrame);
            collection.bind({
                back: () => { collection.close(); this.refresh(); },
                take: id => {
                    const done = this.flow.takeFromCollection(id, this.flow.partyFull ? this.preLevel.selectedMemberId : undefined);
                    if (done) { this.rebuild(); this.refresh(); }
                    return done;
                },
            });
        } else console.warn('GameBootstrap: не назначен CollectionWindow (GameUI/Collection)');

        const resultActions = {
            next: () => {
                if (!this.flow.revivalEnabled) {
                    this.controls.cancel();
                    const advanced = this.flow.advance();
                    if (this.flow.screen === 'complete') { this.rebuild(); this.refresh(); return; }
                    if (this.flow.screen !== 'playing') this.begin();
                    else { this.rebuild(); this.refresh(); }
                } else if (this.flow.showPostLevel()) this.refresh();
            },
            restart: () => {
                this.controls.cancel();
                if (this.flow.start()) { this.rebuild(); this.refresh(); }
            },
            levels: () => this.requestLeave(() => { this.flow.levels(); this.refresh(); }),
        };
        this.levelComplete.bind(resultActions);
        this.levelFailed.bind(resultActions);
        this.leaveWarning.bind();
        this.postLevel.catalog = this.preLevel;
        this.postLevel.setCardFrames(this.preLevel.cardFrame, this.preLevel.selectedCardFrame);
        this.postLevel.bind({
            next: () => this.requestLeave(() => { this.controls.cancel(); this.flow.advance(); this.rebuild(); this.refresh(); }),
            revive: (index, cost) => { const done = this.flow.revive(index, cost); if (done) this.refresh(); return done; },
            store: id => { const done = this.flow.storeMember(id); if (done) this.refresh(); return done; },
            sell: (id, price) => { const done = this.flow.sellMember(id, price); if (done) this.refresh(); return done; },
        });
        this.rebuild();
        this.refresh();
        game.on(Game.EVENT_HIDE, this.onHide, this);
        input.on(Input.EventType.KEY_DOWN, this.onKey, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        this.ready = true;
    }
    protected update(dt: number): void {
        this.applyScreenFit();
        this.fpsFrames++;
        this.fpsTime += dt;
        if (this.fpsTime >= 0.5) {
            this.fpsValue = Math.round(this.fpsFrames / this.fpsTime);
            this.fpsFrames = 0;
            this.fpsTime = 0;
            if (this.hud?.fpsLabel) this.hud.fpsLabel.string = `FPS: ${this.fpsValue}`;
        }
        if (!this.ready) return;
        this.syncTrafficBounds();
        const advanced = this.flow.screen === 'playing';
        this.flow.update(dt);
        if (this.flow.screen !== 'playing') this.controls.cancel();
        for (const event of this.world.drainEvents()) {
            this.audio?.handleEvent(event);
            this.events.eventTarget.emit(`zombie-road:${event.type}`, event);
        }
        this.refresh(false, advanced);
    }
    protected onDestroy(): void {
        this.levelComplete?.unbind();
        this.levelFailed?.unbind();
        this.leaveWarning?.unbind();
        this.economy?.unbind();
        this.disposed = true; this.startup?.unbind(); this.hud?.unbind(); this.preLevel?.unbind(); this.postLevel?.unbind(); this.playingHud?.unbind(); this.collection?.unbind(); this.egg?.unbind();
        game.off(Game.EVENT_HIDE, this.onHide, this);
        input.off(Input.EventType.KEY_DOWN, this.onKey, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        this.controls?.destroy(); this.visuals?.destroy(); this.runtime?.destroy(); this.primitives?.destroy();
    }
    private requestLeave(proceed: () => void): void {
        if (this.postLevel.reviveEffect?.node.active || this.economy?.isOpen) return;
        this.leaveWarning.request(this.flow, this.preLevel, proceed);
    }
    private begin(): void {
        this.controls.cancel();
        if (this.flow.start()) this.rebuild();
        this.refresh();
    }

    private rebuild(): void {
        this.fitLandscapeCamera();
        const camera = this.fittedCamera;
        const size = view.getVisibleSize();
        this.getComponent(ZombieMovementSettings)?.apply(this.world, this.flow.lineup.map(m => m.kind),
            this.preLevel.kindCount, camera && size.height > 0 ? 2 * camera.orthoHeight / size.height : 1 / 40);
        if (camera) this.getComponent(VehicleMovementSettings)?.apply(this.world, this.settings, camera,
            size.height > 0 ? 2 * camera.orthoHeight / size.height : 1 / 40);
        this.visuals.zombieKindOf = this.flow.lineup.map(m => m.kind);
        this.visuals.build(this.world);
        this.world.spriteContacts = this.settings.useSprites && this.fittedCamera
            ? new SpriteContacts(this.world, this.settings, this.fittedCamera, z => {
                const index = this.world.zombies.indexOf(z);
                const kind = this.visuals.zombieKindOf[index] ?? index;
                const skins = this.visuals.zombieSkins;
                return skins.length ? skins[((kind % skins.length) + skins.length) % skins.length] : null;
            }) : undefined;
    }

    private prepare(): void {
        this.controls.cancel();
        if (this.preLevelEnabled) {
            if (this.flow.prepare()) this.rebuild();
        } else {
            if (this.flow.start()) this.rebuild();
        }
        this.refresh();
    }
    private syncTrafficBounds(): void {
        this.fitLandscapeCamera();
        const camera = this.fittedCamera;
        const size = view.getVisibleSize();
        const halfWidth = camera && size.height > 0 ? camera.orthoHeight * size.width / size.height : this.world.layout.halfWidth;
        const centerX = camera?.node.worldPosition.x ?? 0;
        this.world.trafficBounds = { left: centerX - halfWidth, right: centerX + halfWidth };
    }
    private refresh(syncCamera = true, syncWorld = true): void {
        if (syncCamera) this.syncTrafficBounds();
        if (syncWorld) this.visuals.sync(this.world);
        this.controls.update();
        this.audio?.sync(this.world, this.flow.screen === 'playing', this.world.trafficBounds);
        this.hud.refresh(this.world, this.progress, this.flow);
        const playingVisible = ['playing', 'paused', 'result'].includes(this.flow.screen);
        if (this.playingHud.node.active !== playingVisible) this.playingHud.node.active = playingVisible;
        if (playingVisible) this.playingHud.refresh(this.world, this.progress, this.flow);
        if (!this.preLevelEnabled) this.preLevel.node.active = false;
        if (this.preLevelEnabled) this.preLevel.refresh(this.world, this.progress, this.flow, this.reward, Date.now());
        this.levelComplete.refresh(this.flow);
        this.levelFailed.refresh(this.flow);
        this.postLevel.refresh(this.flow, this.progress);
        this.collection?.refresh(this.flow, this.progress, this.preLevel.selectedMemberId);
        this.egg?.refresh(this.flow, this.progress, this.preLevel.selectedMemberId);
        this.economy?.refresh();
    }
    private togglePause(): void { this.controls.cancel(); this.flow.togglePause(); this.refresh(); }
    private onHide(): void { this.resetKeyHeld = false; if (this.flow) { this.controls.cancel(); this.flow.pause(); this.refresh(); } }
    private resetProgress(): void {
        this.controls.cancel();
        this.resumeAfterEconomy = false;
        this.leaveWarning?.close();
        this.economy?.dismissAll();
        this.collection?.close();
        this.egg?.close();
        this.postLevel.reset();
        this.preLevel.selectedIndex = -1;
        this.flow.resetProgress();
        this.rebuild();
        this.hud.notice('');
        this.refresh();
        if (!this.progress.available) console.warn('[ZombieRoad] Прогресс сброшен только в памяти: сохранение недоступно');
    }
    private onKeyUp(e: EventKeyboard): void {
        if (e.keyCode === KeyCode.KEY_R) this.resetKeyHeld = false;
    }
    private onKey(e: EventKeyboard): void {
        if (!this.ready) return;
        if (e.keyCode === KeyCode.KEY_R) {
            if (!this.resetKeyHeld) {
                this.resetKeyHeld = true;
                this.resetProgress();
            }
            return;
        }
        if (this.leaveWarning?.isOpen) {
            if (e.keyCode === KeyCode.ESCAPE) this.leaveWarning.close();
            return;
        }
        if (this.economy?.isOpen) {
            if (e.keyCode === KeyCode.ESCAPE) this.economy.close();
            return;
        }
        if (e.keyCode === KeyCode.ESCAPE && this.controls.aiming) { this.controls.cancel(); return; }
        if (e.keyCode === KeyCode.ESCAPE && this.flow?.teleportArmed) { this.flow.cancelTeleport(); this.refresh(); return; }
        if (e.keyCode === KeyCode.ESCAPE || e.keyCode === KeyCode.SPACE) this.togglePause();
    }
}
