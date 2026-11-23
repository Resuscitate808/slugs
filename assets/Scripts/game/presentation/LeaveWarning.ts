import { _decorator, Button, Component, Sprite, UITransform, ScrollView } from 'cc';
import type { GameFlow } from '../application/GameFlow';
import type { ZombieCatalog } from './PreLevelWindow';
import { fitInto } from './PreLevelCard';

const { ccclass, property } = _decorator;

@ccclass('LeaveWarning')
export class LeaveWarning extends Component {
    @property(Button) back!: Button;
    @property(Button) dismiss!: Button;
    @property(Button) confirm!: Button;
    @property(ScrollView) scroll!: ScrollView;
    @property(UITransform) content!: UITransform;
    @property({ type: [Sprite] }) pictures: Sprite[] = [];
    @property({ type: [UITransform] }) transforms: UITransform[] = [];
    private pending: (() => void) | null = null;
    private bindings: Array<{ button: Button; handler: () => void }> = [];
    get isOpen(): boolean { return this.node.active; }

    bind(): void {
        this.unbind();
        this.listen(this.back, () => this.close());
        this.listen(this.dismiss, () => this.close());
        this.listen(this.confirm, () => {
            const proceed = this.pending;
            this.close();
            proceed?.();
        });
    }
    request(flow: GameFlow, catalog: ZombieCatalog, proceed: () => void): void {
        if (flow.revivalEnabled === false) { this.close(); proceed(); return; }
        if (this.isOpen) return;
        const fallen = flow.screen === 'result' ? flow.outcome?.fallen.filter(entry => !entry.revived) ?? [] : [];
        if (!fallen.length) { proceed(); return; }
        const columns = Math.min(5, fallen.length);
        this.content.setContentSize(840, Math.max(240, Math.ceil(fallen.length / 5) * 120));
        this.pictures.forEach((picture, i) => {
            const entry = fallen[i];
            picture.node.active = !!entry;
            if (!entry) return;
            picture.spriteFrame = catalog.kindFrame(entry.member.kind);
            fitInto(this.transforms[i], picture.spriteFrame, 110, 86);
            picture.node.setPosition((i % 5 - (columns - 1) / 2) * 160, -60 - Math.floor(i / 5) * 120, 0);
        });
        this.pending = proceed;
        this.node.setSiblingIndex(this.node.parent!.children.length - 1);
        this.node.active = true;
        this.scroll.scrollToTop(0);
    }
    close(): void { this.pending = null; this.node.active = false; }
    private listen(button: Button, handler: () => void): void {
        button.node.on(Button.EventType.CLICK, handler, this);
        this.bindings.push({ button, handler });
    }
    unbind(): void {
        this.bindings.forEach(({ button, handler }) => button.node.off(Button.EventType.CLICK, handler, this));
        this.bindings.length = 0;
        this.close();
    }
    protected onDestroy(): void { this.unbind(); }
}
