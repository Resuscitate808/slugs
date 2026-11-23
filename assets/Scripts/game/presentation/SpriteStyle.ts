import { _decorator, CCFloat, CCInteger, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('RoadSpriteStyle')
export class SpriteStyle {
    @property({ type: SpriteFrame }) frame: SpriteFrame | null = null;
    @property({ type: CCFloat, min: 0.05 }) width = 1.4;
    @property({ type: CCFloat, min: 0 }) height = 0;
    @property({  }) billboard = true;
    @property({  }) bottomAnchor = true;
    @property({  }) flipWithDirection = true;
    @property({ type: CCFloat }) rotation = 0;
    @property({ type: CCFloat }) lift = 0;
    @property({ type: CCFloat, min: 0.01, max: 1 }) contactAlphaThreshold = 0.5;
}

@ccclass('RoadObstacleSprite')
export class ObstacleSprite {
    @property({  }) type = 'tire';
    @property({ type: SpriteStyle }) sprite = new SpriteStyle();
}

@ccclass('RoadLandscapeSprite')
export class LandscapeSprite {
    @property({ type: CCInteger, min: 0, max: 5 }) level = 0;
    @property({ type: SpriteStyle }) sprite = new SpriteStyle();
    @property({ type: CCFloat }) x = 0;
    @property({ type: CCFloat }) z = 2;
    constructor() {
        this.sprite.width = 36; this.sprite.height = 25;
        this.sprite.billboard = false; this.sprite.bottomAnchor = false;
        this.sprite.flipWithDirection = false;
    }
}

@ccclass('ZombieLook')
export class ZombieLook {
    @property({ type: CCFloat, min: 0.05 }) width = 1.1;
    @property({ type: CCFloat, min: 0 }) height = 0;
    @property({  }) billboard = true;
    @property({  }) bottomAnchor = true;
    @property({  }) flipWithDirection = true;
    @property({ type: CCFloat }) rotation = 0;
    @property({ type: CCFloat }) lift = 0;
    @property({ type: CCFloat, min: 0.01, max: 1 }) contactAlphaThreshold = 0.5;

    toStyle(frame: SpriteFrame): SpriteStyle {
        const s = new SpriteStyle();
        s.frame = frame; s.width = this.width; s.height = this.height; s.billboard = this.billboard;
        s.bottomAnchor = this.bottomAnchor; s.flipWithDirection = this.flipWithDirection;
        s.rotation = this.rotation; s.lift = this.lift;
        s.contactAlphaThreshold = this.contactAlphaThreshold;
        return s;
    }
}

export function actorStyle(width: number, bottomAnchor = true, billboard = true): SpriteStyle {
    const style = new SpriteStyle();
    style.width = width; style.bottomAnchor = bottomAnchor; style.billboard = billboard;
    return style;
}
