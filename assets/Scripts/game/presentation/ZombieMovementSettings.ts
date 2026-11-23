import { _decorator, CCInteger, Component, Enum } from 'cc';
import { IdleProfile, attachIdleMovement } from '../domain/IdleMovement';
import { World } from '../domain/World';

const { ccclass, property } = _decorator;
export enum SlugMotion { Legacy = 0, WalkAndRest = 1, JumpSeries = 2, Continuous = 3 }

@ccclass('SlugMovementProfile')
export class SlugMovementProfile {
    @property({ type: CCInteger, min: 0 }) skinIndex = 0;
    @property name = '';
    @property({ type: Enum(SlugMotion) }) mode = SlugMotion.WalkAndRest;
    @property({ min: 0 }) speedPixels = 66;
    @property({ min: 0.01 }) walkMin = 2;
    @property({ min: 0.01 }) walkMax = 4;
    @property({ min: 0.01 }) restMin = 0.8;
    @property({ min: 0.01 }) restMax = 1.5;
    @property({ min: 0 }) jumpMinPixels = 132;
    @property({ min: 0 }) jumpMaxPixels = 220;
    @property({ min: 0.01 }) jumpDuration = 0.25;
    @property({ type: CCInteger, min: 1 }) jumpsMin = 1;
    @property({ type: CCInteger, min: 1 }) jumpsMax = 2;
    @property({ min: 0.01 }) jumpPause = 0.15;
    @property({ min: 0 }) jumpHeightPixels = 18;

    toProfile(unitsPerPixel: number): IdleProfile {
        const value = (n: number, fallback: number, min = 0): number => Number.isFinite(n) ? Math.max(min, n) : fallback;
        return {
            mode: this.mode,
            speed: value(this.speedPixels, 66) * unitsPerPixel,
            walkMin: value(this.walkMin, 2, 0.01), walkMax: value(this.walkMax, 4, 0.01),
            restMin: value(this.restMin, 0.8, 0.01), restMax: value(this.restMax, 1.5, 0.01),
            jumpMin: value(this.jumpMinPixels, 132) * unitsPerPixel,
            jumpMax: value(this.jumpMaxPixels, 220) * unitsPerPixel,
            jumpDuration: value(this.jumpDuration, 0.25, 0.01),
            jumpsMin: Math.floor(value(this.jumpsMin, 1, 1)), jumpsMax: Math.floor(value(this.jumpsMax, 2, 1)),
            jumpPause: value(this.jumpPause, 0.15, 0.01),
            jumpHeight: value(this.jumpHeightPixels, 18) * unitsPerPixel,
        };
    }
}

@ccclass('ZombieMovementSettings')
export class ZombieMovementSettings extends Component {
    @property({ type: [SlugMovementProfile] }) profiles: SlugMovementProfile[] = [];

    apply(world: World, kinds: readonly number[], kindCount: number, unitsPerPixel: number): void {
        const scale = world.config.unitsPerPixel ?? (Number.isFinite(unitsPerPixel) && unitsPerPixel > 0 ? unitsPerPixel : 1 / 40);
        world.zombies.forEach((z, index) => {
            if (z.state !== 'idle' || z.idleMotion) return;
            const kind = ((kinds[index] ?? index) % kindCount + kindCount) % kindCount;
            const profile = this.profiles.find(p => p.skinIndex === kind);
            if (profile && [1, 2, 3].includes(profile.mode)) attachIdleMovement(z, profile.toProfile(scale), world.random);
        });
    }
}
