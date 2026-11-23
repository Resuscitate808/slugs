import { _decorator, Button, Component, Label, UITransform } from 'cc';
import type { GameFlow } from '../application/GameFlow';

const { ccclass, property } = _decorator;

@ccclass('LevelResultWindow')
export class LevelResultWindow extends Component {
    @property won = true;
    @property(Button) nextButton: Button | null = null;
    @property(Button) restartButton: Button | null = null;
    @property(Button) levelsButton: Button | null = null;
    @property(Button) exitButton: Button | null = null;
    @property(Label) savedLabel!: Label;
    @property(Label) targetLabel!: Label;
    @property(UITransform) track!: UITransform;
    @property(UITransform) fill!: UITransform;
    @property(UITransform) targetTrack!: UITransform;
    @property(UITransform) targetFill!: UITransform;
    private bindings: Array<{ button: Button; handler: () => void }> = [];

    bind(actions: { next: () => void; restart?: () => void; levels: () => void }): void {
        this.unbind();
        if (this.nextButton) this.listen(this.nextButton, actions.next);
        if (this.restartButton && actions.restart) this.listen(this.restartButton, actions.restart);
        if (this.levelsButton) this.listen(this.levelsButton, actions.levels);
        if (this.exitButton) this.listen(this.exitButton, actions.levels);
    }
    refresh(flow: GameFlow): void {
        const result = flow.world.result;
        const visible = flow.screen === 'result' && flow.resultIntro && !!result && result.won === this.won;
        if (this.node.active !== visible) this.node.active = visible;
        if (!visible || !result) return;
        const saved = `${result.saved} / ${result.total}`;
        const target = `${result.saved} / ${flow.target}`;
        if (this.savedLabel.string !== saved) this.savedLabel.string = saved;
        if (this.targetLabel.string !== target) this.targetLabel.string = target;
        this.drawBar(this.track, this.fill, result.total > 0 ? result.saved / result.total : 0);
        this.drawBar(this.targetTrack, this.targetFill, flow.target > 0 ? result.saved / flow.target : 0);
    }
    unbind(): void {
        this.bindings.forEach(({ button, handler }) => button.node.off(Button.EventType.CLICK, handler, this));
        this.bindings.length = 0;
    }
    protected onDestroy(): void { this.unbind(); }
    private listen(button: Button, action: () => void): void {
        const handler = (): void => { if (this.node.active) action(); };
        button.node.on(Button.EventType.CLICK, handler, this);
        this.bindings.push({ button, handler });
    }
    private drawBar(track: UITransform, fill: UITransform, ratio: number): void {
        const width = track.width * Math.max(0, Math.min(1, ratio));
        if (Math.abs(fill.width - width) > 0.01) fill.setContentSize(width, fill.height);
        if (fill.node.active !== (width >= 1)) fill.node.active = width >= 1;
    }
}
