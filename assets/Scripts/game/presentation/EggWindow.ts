import { _decorator, Button, Component, Label, Node, Sprite, Tween, tween, UITransform, Vec3 } from 'cc';
import { GameFlow } from '../application/GameFlow';
import { Progress } from '../application/Progress';
import type { PartyMember } from '../application/Party';
import { fitInto } from './PreLevelCard';
import type { ZombieCatalog } from './PreLevelWindow';

const { ccclass, property } = _decorator;

interface EggActions { toParty: (id: number) => boolean }

@ccclass('EggWindow')
export class EggWindow extends Component {
    @property({ type: Node }) dialog: Node | null = null;
    @property({ type: Node }) halo: Node | null = null;
    @property({ type: Label }) title!: Label;
    @property({ type: Label }) rarity!: Label;
    @property({ type: Sprite }) picture!: Sprite;
    @property(UITransform) pictureTransform!: UITransform;
    @property(Button) closeButton!: Button;
    @property(Button) toCollectionButton!: Button;
    @property(Button) toPartyButton!: Button;
    @property({ type: Label }) toPartyLabel: Label | null = null;
    @property({ type: Label }) hint: Label | null = null;
    @property({ min: 1 }) pictureMax = 150;
    @property({  }) titleText = 'Новый слизень!';
    @property({  }) addText = 'В партию';
    @property({  }) replaceText = 'Заменить выбранного';
    @property({  }) fullHint = 'Партия полная: выбери слизня на подготовке, его заменит новый.';
    @property({ min: 0.05 }) appear = 0.35;

    catalog: ZombieCatalog | null = null;
    member: PartyMember | null = null;
    private bindings: Array<{ button: Button; handler: () => void }> = [];

    get isOpen(): boolean { return !!this.member; }

    show(member: PartyMember): void {
        this.member = { ...member };
        this.node.active = true;
        this.animate();
    }
    close(): void { this.member = null; this.stopAll(); }

    bind(actions: EggActions): void {
        this.unbind();
        this.listen(this.closeButton, () => this.close());
        this.listen(this.toCollectionButton, () => this.close());
        this.listen(this.toPartyButton, () => {
            const id = this.member?.id;
            if (id !== undefined && actions.toParty(id)) this.close();
        });
    }
    unbind(): void {
        for (const { button, handler } of this.bindings) button.node.off(Button.EventType.CLICK, handler, this);
        this.bindings.length = 0;
    }
    private listen(button: Button, handler: () => void): void {
        if (!button) throw new Error('EggWindow: не назначена кнопка в инспекторе');
        button.node.on(Button.EventType.CLICK, handler, this);
        this.bindings.push({ button, handler });
    }
    protected onDestroy(): void { this.unbind(); this.stopAll(); }

    refresh(flow: GameFlow, progress: Progress, replaceId: number | undefined): void {
        if (this.member && (flow.screen !== 'prelevel' || !progress.collection.some(m => m.id === this.member!.id))) this.member = null;
        const visible = !!this.member;
        if (this.node.active !== visible) this.node.active = visible;
        if (!visible || !this.member) return;
        const member = this.member, catalog = this.catalog;
        this.title.string = this.titleText;
        if (catalog) {
            const frame = catalog.kindFrame(member.kind);
            if (frame) this.picture.spriteFrame = frame;
            const name = catalog.kindName(member.kind), stage = catalog.growthCaption(member.growth).toLowerCase();
            this.rarity.string = name && stage ? `${name} · ${stage}` : name || stage;
        }
        fitInto(this.pictureTransform, this.picture.spriteFrame, this.pictureMax, this.pictureMax);
        const full = flow.partyFull;
        if (this.toPartyLabel) this.toPartyLabel.string = full ? this.replaceText : this.addText;
        this.toPartyButton.interactable = !full || replaceId !== undefined;
        if (this.hint) {
            const show = full && replaceId === undefined;
            if (this.hint.node.active !== show) this.hint.node.active = show;
            this.hint.string = this.fullHint;
        }
    }

    private animate(): void {
        this.stopAll();
        if (this.dialog) {
            this.dialog.setScale(0.6, 0.6, 1);
            tween(this.dialog).to(this.appear, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        }
        const pic = this.picture?.node;
        if (pic) {
            pic.setScale(0.2, 0.2, 1);
            pic.angle = -20;
            tween(pic).delay(this.appear * 0.6).to(this.appear * 1.4, { scale: new Vec3(1, 1, 1), angle: 0 }, { easing: 'elasticOut' })
                .call(() => tween(pic).repeatForever(tween(pic)
                    .to(0.9, { scale: new Vec3(1.05, 0.96, 1) }, { easing: 'sineInOut' })
                    .to(0.9, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })).start())
                .start();
        }
        if (this.halo) {
            this.halo.setScale(0, 0, 1);
            tween(this.halo).to(this.appear * 1.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        }
    }
    private stopAll(): void {
        if (this.dialog) Tween.stopAllByTarget(this.dialog);
        if (this.halo) Tween.stopAllByTarget(this.halo);
        if (this.picture?.node) Tween.stopAllByTarget(this.picture.node);
    }
}
