import { _decorator, Component, Prefab, CCInteger, CCFloat, Camera, Node, JsonAsset, SpriteFrame, Vec3, AudioClip } from 'cc';
import { SpriteStyle, ObstacleSprite, LandscapeSprite, actorStyle } from './SpriteStyle';
import { DEFAULT_CONFIG, GameConfig, VehicleKind } from '../domain/Model';
import { vehicleSpriteShapes, DEFAULT_CAMERA_BASIS } from './VehicleSpriteBounds';
const { ccclass, property } = _decorator;

@ccclass('GameSettings')
export class GameSettings extends Component {
    @property({ type: CCInteger, min: 1, max: 100 }) zombieCount = 20;
    @property({ type: CCFloat, min: 10 }) roundSeconds = 180;
    @property({ type: CCFloat, min: 0.1 }) zombieSpeed = 0.72;
    @property({ type: CCFloat, min: 0.3 }) trafficInterval = 2.1;
    @property({ type: CCFloat, range: [0, 1, 0.01], slide: true }) bushChance = 0.28;
    @property({ type: CCFloat, range: [0, 1, 0.01], slide: true }) ditchSlipChance = 0.28;
    @property({ type: CCFloat, range: [0, 1, 0.01], slide: true }) bloodSlipChance = 0.5;
    @property({  }) driverExitEnabled = DEFAULT_CONFIG.driverExitEnabled;
    @property({ type: CCFloat, range: [0, 1, 0.01], slide: true }) driverExitChance = 0.25;
    @property({ type: CCFloat, min: 0.1 }) fallSeconds = 1.8;
    @property({ type: CCFloat, min: 0.1 }) driverEatSeconds = 8;
    @property({ type: CCFloat, min: 1 }) driverInspectSeconds = 30;
    @property({ type: CCInteger, min: 1, max: 60 }) maxVehicles = 24;
    @property({ type: [CCFloat], min: 1.4 }) laneWidths: number[] = [...DEFAULT_CONFIG.laneWidths];
    @property({ type: CCFloat }) laneOffsetZ = DEFAULT_CONFIG.laneOffsetZ;
    @property({ type: CCFloat }) finishOffsetZ = DEFAULT_CONFIG.finishOffsetZ;
    @property({ type: CCFloat }) vehicleOffsetZ = DEFAULT_CONFIG.vehicleOffsetZ;
    @property({ type: CCInteger, min: 0 }) seed = 0;
    @property({ type: CCInteger, min: 1, max: 5 }) startingLevel = 1;
    @property({ type: JsonAsset }) levelCatalog: JsonAsset | null = null;
    @property({  }) useSprites = true;
    @property({ type: SpriteStyle }) ordinaryCarSprite = actorStyle(2.3);
    @property(AudioClip) ordinaryCarSound: AudioClip | null = null;
    @property({ type: CCFloat, range: [0, 1, 0.01], slide: true }) ordinaryCarVolume = 0.5;
    @property({ type: SpriteStyle }) jeepSprite = actorStyle(2.5);
    @property(AudioClip) jeepSound: AudioClip | null = null;
    @property({ type: CCFloat, range: [0, 1, 0.01], slide: true }) jeepVolume = 0.5;
    @property({ type: SpriteStyle }) pinkCarSprite = actorStyle(2.2);
    @property(AudioClip) pinkCarSound: AudioClip | null = null;
    @property({ type: CCFloat, range: [0, 1, 0.01], slide: true }) pinkCarVolume = 0.5;
    @property({ type: SpriteStyle }) bloodSprite = actorStyle(1.5, false, false);
    @property({ type: SpriteStyle }) driverSprite = actorStyle(1);
    @property({ type: [ObstacleSprite] }) obstacleSprites: ObstacleSprite[] = [];
    @property({ type: [LandscapeSprite] }) landscapeSprites: LandscapeSprite[] = [];
    @property({ type: SpriteFrame }) arrowSprite: SpriteFrame | null = null;
    @property({ type: SpriteFrame }) arrowPlatformSprite: SpriteFrame | null = null;
    @property({  }) showObstacleBounds = false;
    @property generateEnvironment = true;
    @property({ type: Camera }) gameCamera: Camera | null = null;
    @property({ type: Node }) environmentRoot: Node | null = null;
    @property({ type: Prefab }) zombiePrefab: Prefab | null = null;
    @property({ type: Prefab }) ordinaryCarPrefab: Prefab | null = null;
    @property({ type: Prefab }) jeepPrefab: Prefab | null = null;
    @property({ type: Prefab }) pinkCarPrefab: Prefab | null = null;
    @property({ type: Prefab }) bloodPrefab: Prefab | null = null;
    @property({ type: Prefab }) driverPrefab: Prefab | null = null;

    soundFor(kind: VehicleKind): { clip: AudioClip | null; volume: number } {
        if (kind === 'jeep') return { clip: this.jeepSound, volume: this.jeepVolume };
        if (kind === 'pink') return { clip: this.pinkCarSound, volume: this.pinkCarVolume };
        return { clip: this.ordinaryCarSound, volume: this.ordinaryCarVolume };
    }

    spriteFor(kind: string): SpriteStyle | null {
        if (!this.useSprites) return null;
        const styles: Record<string, SpriteStyle> = {
            ordinary: this.ordinaryCarSprite, jeep: this.jeepSprite,
            pink: this.pinkCarSprite, blood: this.bloodSprite, driver: this.driverSprite,
        };
        const style = styles[kind];
        return style?.frame ? style : null;
    }
    toConfig(): Partial<GameConfig> {
        const rotation = this.gameCamera?.node.worldRotation;
        const basis = rotation ? {
            right: Vec3.transformQuat(new Vec3(), new Vec3(1, 0, 0), rotation),
            up: Vec3.transformQuat(new Vec3(), new Vec3(0, 1, 0), rotation),
            forward: Vec3.transformQuat(new Vec3(), new Vec3(0, 0, -1), rotation),
        } : DEFAULT_CAMERA_BASIS;
        const vehicleShapes: GameConfig['vehicleShapes'] = {};
        for (const kind of ['ordinary', 'jeep', 'pink'] as VehicleKind[]) {
            const style = this.spriteFor(kind);
            if (style) vehicleShapes[kind] = vehicleSpriteShapes(style, basis);
        }
        return {
            vehicleShapes, vehicleOffsetZ: this.vehicleOffsetZ,
            laneWidths: [...this.laneWidths], laneOffsetZ: this.laneOffsetZ, finishOffsetZ: this.finishOffsetZ,
            zombieCount: this.zombieCount, duration: this.roundSeconds, zombieSpeed: this.zombieSpeed,
            trafficInterval: this.trafficInterval, bushChance: this.bushChance, ditchSlipChance: this.ditchSlipChance,
            bloodSlipChance: this.bloodSlipChance,
            driverExitEnabled: this.driverExitEnabled,
            driverExitChance: this.driverExitChance, fallDuration: this.fallSeconds,
            eatDuration: this.driverEatSeconds, driverInspectDuration: this.driverInspectSeconds, maxVehicles: this.maxVehicles,
        };
    }
}
