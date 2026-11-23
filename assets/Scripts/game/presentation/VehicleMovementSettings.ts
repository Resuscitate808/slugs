import { _decorator, CCFloat, CCInteger, Component, Camera, Vec3 } from 'cc';
import { VehicleKind } from '../domain/Model';
import { World } from '../domain/World';
import { GameSettings } from './GameSettings';
import { vehicleSpriteShapes } from './VehicleSpriteBounds';
const { ccclass, property } = _decorator;

@ccclass('TrafficVehicleProfile')
export class TrafficVehicleProfile {
    @property name = '';
    @property({ type: CCFloat, min: 1 }) speedPixels = 330;
    @property({ type: CCFloat, min: 1 }) lengthPixels = 660;
    @property({ type: CCFloat, min: 1 }) widthPixels = 143;
    @property({ type: CCInteger, min: 1, max: 5 }) firstLevel = 1;
    @property({ type: CCFloat, min: 0 }) weight = 1;
}
function profile(name: string, speed: number, length: number, firstLevel: number, weight: number): TrafficVehicleProfile {
    return Object.assign(new TrafficVehicleProfile(), { name, speedPixels: speed, lengthPixels: length, firstLevel, weight });
}

@ccclass('VehicleMovementSettings')
export class VehicleMovementSettings extends Component {
    @property({ type: TrafficVehicleProfile }) trailer = profile('Длинный прицеп — Jeep', 330, 660, 1, 1);
    @property({ type: TrafficVehicleProfile }) courier = profile('Безбашенный доставщик — Pink Car', 990, 220, 1, 1);
    @property({ type: TrafficVehicleProfile }) van = profile('Фургон — Ordinary Car', 572, 396, 1, 1);

    apply(world: World, settings: GameSettings, camera: Camera, unitsPerPixel: number): void {
        if (!this.enabled) return;
        const scale = world.config.unitsPerPixel ?? (Number.isFinite(unitsPerPixel) && unitsPerPixel > 0 ? unitsPerPixel : 1 / 40);
        const rotation = camera.node.worldRotation;
        const basis = {
            right: Vec3.transformQuat(new Vec3(), new Vec3(1, 0, 0), rotation),
            up: Vec3.transformQuat(new Vec3(), new Vec3(0, 1, 0), rotation),
            forward: Vec3.transformQuat(new Vec3(), new Vec3(0, 0, -1), rotation),
        };
        world.config.vehicleProfiles = {};
        world.config.vehicleShapes = { ...world.config.vehicleShapes };
        const entries: [VehicleKind, TrafficVehicleProfile][] = [['jeep', this.trailer], ['pink', this.courier], ['ordinary', this.van]];
        const positive = (value: number, fallback: number): number => Number.isFinite(value) && value > 0 ? value : fallback;
        for (const [kind, p] of entries) {
            world.config.vehicleProfiles[kind] = {
                speed: positive(p.speedPixels, 330) * scale,
                firstLevel: Math.max(1, Math.min(5, Math.round(positive(p.firstLevel, 1)))),
                weight: Number.isFinite(p.weight) ? Math.max(0, p.weight) : 1,
            };
            const style = settings.spriteFor(kind);
            if (!style) continue;
            style.width = positive(p.lengthPixels, 220) * scale;
            style.height = positive(p.widthPixels, 143) * scale;
            world.config.vehicleShapes[kind] = vehicleSpriteShapes(style, basis);
        }
    }
}
