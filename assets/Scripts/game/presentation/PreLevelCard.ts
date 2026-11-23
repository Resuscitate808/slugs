import { _decorator, Button, Component, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import type { PartyMember } from '../application/Party';
import type { ZombieCatalog } from './PreLevelWindow';

const { ccclass, property } = _decorator;

export function fitInto(transform: UITransform | null | undefined, frame: SpriteFrame | null, maxWidth: number, maxHeight: number): void {
    const size = frame?.originalSize;
    if (!transform || !size || !(size.width > 0) || !(size.height > 0)) return;
    const k = Math.min(maxWidth / size.width, maxHeight / size.height);
    const width = Math.round(size.width * k), height = Math.round(size.height * k);
    if (transform.width !== width || transform.height !== height) transform.setContentSize(width, height);
}

@ccclass('PreLevelCard')
export class PreLevelCard extends Component {
    @property({ type: Sprite }) body!: Sprite;
    @property({ type: Sprite }) picture!: Sprite;
    @property({ type: UITransform }) pictureTransform!: UITransform;
    @property({ type: Label }) title!: Label;
    @property({ type: Label }) caption!: Label;
    @property({ type: Node }) selectedBadge!: Node;
    @property({ type: Button }) button!: Button;

    show(member: PartyMember, catalog: ZombieCatalog, maxWidth: number, maxHeight: number, caption = catalog.growthCaption(member.growth)): void {
        const frame = catalog.kindFrame(member.kind);
        if (frame && this.picture && this.picture.spriteFrame !== frame) this.picture.spriteFrame = frame;
        const name = catalog.kindName(member.kind);
        if (name && this.title && this.title.string !== name) this.title.string = name;
        if (this.caption && this.caption.string !== caption) this.caption.string = caption;
        this.fitPicture(this.picture?.spriteFrame ?? null, maxWidth, maxHeight);
    }
    fitPicture(frame: SpriteFrame | null, maxWidth: number, maxHeight: number): void {
        fitInto(this.pictureTransform, frame, maxWidth, maxHeight);
    }
}
