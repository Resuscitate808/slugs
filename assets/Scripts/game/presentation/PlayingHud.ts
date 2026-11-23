import { _decorator, Button, Component, Label, Node, Sprite, UITransform } from 'cc';
import { World } from '../domain/World';
import { Progress } from '../application/Progress';
import { GameFlow } from '../application/GameFlow';

const { ccclass, property } = _decorator;

interface PlayingHudActions { slow: () => void; teleport: () => void }

@ccclass('PlayingHud')
export class PlayingHud extends Component {
    @property({ type: Label }) levelLabel!: Label;
    @property({ type: Label }) timeLabel: Label | null = null;
    @property({ type: Label }) savedLabel!: Label;
    @property({ type: Label }) targetLabel!: Label;
    @property({ type: UITransform }) track!: UITransform;
    @property({ type: UITransform }) fill!: UITransform;
    @property({ type: UITransform }) targetTrack!: UITransform;
    @property({ type: UITransform }) targetFill!: UITransform;
    @property(Button) slowButton!: Button;
    @property({ type: Label }) slowCount!: Label;
    @property(Button) teleportButton!: Button;
    @property({ type: Label }) teleportCount!: Label;
    @property({ type: Node }) teleportArmed: Node | null = null;
    @property({ type: Node }) teleportHint: Node | null = null;
    @property({ min: 0.1 }) slowDuration = 5;
    @property({ range: [0.05, 0.95, 0.05], slide: true }) slowFactor = 0.4;
    @property({ min: 0.1 }) teleportDuration = 0.7;
    @property({ min: 0.1 }) fillSpeed = 1.5;
    private bindings: Array<{ button: Button; handler: () => void }> = [];
    private shownRatio = 0;
    private targetRatio = 0;
    private world: World | null = null;
    private goalRatio = 0;
    private shownGoalRatio = 0;

    bind(actions: PlayingHudActions): void {
        this.unbind();
        this.listen(this.slowButton, actions.slow);
        this.listen(this.teleportButton, actions.teleport);
    }
    unbind(): void {
        for (const { button, handler } of this.bindings) button.node.off(Button.EventType.CLICK, handler, this);
        this.bindings.length = 0;
    }
    private listen(button: Button, handler: () => void): void {
        if (!button) throw new Error('PlayingHud: не назначена кнопка бустера в инспекторе');
        button.node.on(Button.EventType.CLICK, handler, this);
        this.bindings.push({ button, handler });
    }
    protected onDestroy(): void { this.unbind(); }

    refresh(world: World, progress: Progress, flow: GameFlow): void {
        if (world !== this.world) { this.world = world; this.shownRatio = 0; this.shownGoalRatio = 0; }
        const total = Math.max(1, world.zombies.length);
        const saved = world.zombies.filter(z => z.state === 'saved').length;
        this.levelLabel.string = String(flow.selectedLevel).padStart(3, '0');
        if (this.timeLabel) {
            const seconds = Math.max(0, Math.ceil(world.config.duration - world.elapsed));
            this.timeLabel.string = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        }
        this.savedLabel.string = `${saved} / ${world.zombies.length}`;
        this.targetLabel.string = `${saved} / ${flow.target}`;
        this.targetRatio = Math.min(1, saved / total);
        this.goalRatio = flow.target > 0 ? Math.min(1, saved / flow.target) : 0;
        this.drawFill();

        const playing = flow.screen === 'playing';
        const slowing = world.slowTime > 0;
        const slowLeft = progress.boosterCount('slow'), teleportLeft = progress.boosterCount('teleport');
        this.slowCount.string = slowing ? `${Math.ceil(world.slowTime)} с` : `×${slowLeft}`;
        this.setEnabled(this.slowButton, playing && !slowing && slowLeft > 0);
        this.teleportCount.string = `×${teleportLeft}`;
        this.setEnabled(this.teleportButton, playing && (teleportLeft > 0 || flow.teleportArmed));
        if (this.teleportArmed && this.teleportArmed.active !== flow.teleportArmed) this.teleportArmed.active = flow.teleportArmed;
        if (this.teleportHint && this.teleportHint.active !== flow.teleportArmed) this.teleportHint.active = flow.teleportArmed;
    }

    protected update(dt: number): void {
        if (!this.fill || !this.track) return;
        this.shownGoalRatio = this.advance(this.shownGoalRatio, this.goalRatio, this.fillSpeed * dt);
        const step = this.fillSpeed * dt;
        this.shownRatio = this.shownRatio < this.targetRatio
            ? Math.min(this.targetRatio, this.shownRatio + step)
            : Math.max(this.targetRatio, this.shownRatio - step);
        this.drawFill();
    }
    private drawFill(): void {
        this.drawBar(this.targetTrack, this.targetFill, this.shownGoalRatio);
        this.drawBar(this.track, this.fill, this.shownRatio);
    }
    private advance(current: number, target: number, step: number): number {
        return current < target ? Math.min(target, current + step) : Math.max(target, current - step);
    }
    private drawBar(track: UITransform, fill: UITransform, ratio: number): void {
        if (!track || !fill) return;
        const width = track.width * ratio;
        if (Math.abs(fill.width - width) > 0.01) fill.setContentSize(width, fill.height);
        const visible = width >= 1;
        if (fill.node.active !== visible) fill.node.active = visible;
    }
    private setEnabled(button: Button, on: boolean): void {
        if (button.interactable !== on) button.interactable = on;
        const sprite = button.getComponent?.(Sprite);
        if (sprite && sprite.grayscale !== !on) sprite.grayscale = !on;
    }
}
