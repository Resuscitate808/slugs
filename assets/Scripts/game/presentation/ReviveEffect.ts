import { _decorator, Component, Node, Tween, tween, UIOpacity, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ReviveEffect')
export class ReviveEffect extends Component {
    @property({ type: Node }) plate: Node | null = null;
    @property({ type: Node }) icon: Node | null = null;
    @property({ type: UIOpacity }) opacity: UIOpacity | null = null;
    @property({ min: 0.5 }) duration = 3;
    @property({ min: 0.05 }) appear = 0.35;
    @property({ min: 0.05 }) fade = 0.5;
    @property({  }) turns = 1;

    play(): void {
        this.stopAll();
        this.node.active = true;
        const total = Math.max(this.duration, this.appear + this.fade);
        const hold = total - this.appear - this.fade;
        if (this.opacity) {
            this.opacity.opacity = 0;
            tween(this.opacity).to(this.appear, { opacity: 255 }).delay(hold).to(this.fade, { opacity: 0 }).start();
        }
        if (this.plate) {
            this.plate.setScale(0.4, 0.4, 1);
            tween(this.plate).to(this.appear, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).delay(hold)
                .to(this.fade, { scale: new Vec3(0.85, 0.85, 1) }, { easing: 'quadIn' }).start();
        }
        if (this.icon) {
            this.icon.angle = 0;
            this.icon.setScale(1, 1, 1);
            tween(this.icon).to(total, { angle: -360 * this.turns }, { easing: 'quadInOut' }).start();

            const beat = total / 6;
            tween(this.icon).repeat(3, tween(this.icon)
                .to(beat, { scale: new Vec3(1.15, 1.15, 1) }, { easing: 'sineOut' })
                .to(beat, { scale: new Vec3(1, 1, 1) }, { easing: 'sineIn' })).start();
        }
        tween(this.node).delay(total).call(() => { this.node.active = false; }).start();
    }

    cancel(): void {
        this.stopAll();
        this.node.active = false;
    }

    protected onDisable(): void { this.stopAll(); }

    private stopAll(): void {
        Tween.stopAllByTarget(this.node);
        if (this.plate) Tween.stopAllByTarget(this.plate);
        if (this.icon) Tween.stopAllByTarget(this.icon);
        if (this.opacity) Tween.stopAllByTarget(this.opacity);
    }
}
