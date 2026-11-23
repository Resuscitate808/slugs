import { _decorator, Component, Node, Label, Button, Color, Sprite, SpriteFrame, view } from 'cc';
import { World } from '../domain/World';
import { Progress } from '../application/Progress';
import { GameFlow, TEST_LEVELS } from '../application/GameFlow';

const { ccclass, property } = _decorator;
interface HudActions {
    select: (level: number) => void;
    play: () => void;
    pause: () => void;
    retry: () => void;
    levels: () => void;
    cancel: () => void;
}

@ccclass('GameHud')
export class GameHud extends Component {
    @property(Node) gameLayer!: Node;
    @property(Node) levels!: Node;
    @property(Node) paused!: Node;
    @property(Node) complete!: Node;
    @property(Node) portrait!: Node;
    @property(Label) hint!: Label;
    @property(Label) completionText!: Label;
    @property(Label) levelInfo!: Label;
    @property(Label) wallet!: Label;
    @property(Label) fpsLabel: Label | null = null;
    @property([Button]) levelButtons: Button[] = [];
    @property([Label]) levelLabels: Label[] = [];
    @property([Label]) levelStars: Label[] = [];
    @property({ type: SpriteFrame }) levelOpenSprite: SpriteFrame | null = null;
    @property({ type: SpriteFrame }) levelCurrentSprite: SpriteFrame | null = null;
    @property({ type: SpriteFrame }) levelClosedSprite: SpriteFrame | null = null;
    @property({ type: [Node] }) levelLockNodes: Node[] = [];
    @property(Button) playButton!: Button;
    @property(Button) pauseButton!: Button;
    @property(Button) cancelButton!: Button;
    @property(Button) resumeButton!: Button;
    @property(Button) restartButton!: Button;
    @property(Button) pauseLevelsButton!: Button;
    @property(Button) pausePanelLevelsButton!: Button;
    @property(Button) pauseExitButton: Button | null = null;
    @property(Button) chooseLevelButton!: Button;
    @property(Color) selectedColor = new Color(255, 241, 204, 255);
    @property(Color) unselectedColor = new Color(192, 216, 206, 255);
    @property(Color) levelOpenColor = new Color(192, 216, 206, 255);
    @property(Color) levelCurrentColor = new Color(255, 241, 204, 255);
    private bindings: Array<{ button: Button; handler: () => void }> = [];

    bind(actions: HudActions): void {
        this.unbind();
        if (this.levelButtons.length !== TEST_LEVELS.length || this.levelLabels.length !== TEST_LEVELS.length || this.levelStars.length !== TEST_LEVELS.length)
            throw new Error('GameHud: назначьте пять кнопок, подписей и рейтингов уровней в инспекторе');
        this.levelButtons.forEach((button, index) => this.listen(button, () => actions.select(TEST_LEVELS[index])));
        this.listen(this.playButton, actions.play);
        this.listen(this.pauseButton, actions.pause);
        this.listen(this.cancelButton, actions.cancel);
        this.listen(this.resumeButton, actions.pause);
        this.listen(this.restartButton, actions.retry);
        this.listen(this.pauseLevelsButton, actions.levels);
        this.listen(this.pausePanelLevelsButton, actions.levels);
        const pauseExit = this.pauseExitButton ?? this.findButton(this.paused, 'Exit');
        if (pauseExit) this.listen(pauseExit, actions.pause);
        this.listen(this.chooseLevelButton, actions.levels);
    }
    unbind(): void {
        for (const { button, handler } of this.bindings) button.node.off(Button.EventType.CLICK, handler, this);
        this.bindings.length = 0;
    }
    private listen(button: Button, handler: () => void): void {
        if (!button) throw new Error('GameHud: не назначена кнопка в инспекторе');
        button.node.on(Button.EventType.CLICK, handler, this);
        this.bindings.push({ button, handler });
    }
    private findButton(root: Node, name: string): Button | null {
        if (!root) return null;
        if (root.name === name) return root.getComponent(Button);
        for (const child of root.children) {
            const button = this.findButton(child, name);
            if (button) return button;
        }
        return null;
    }
    protected onDestroy(): void { this.unbind(); }
    refresh(world: World, progress: Progress, flow: GameFlow): void {

        this.gameLayer.active = ['playing', 'paused', 'result'].includes(flow.screen);
        this.levels.active = flow.screen === 'levels';
        this.paused.active = flow.screen === 'paused';
        this.complete.active = flow.screen === 'complete';
        this.portrait.active = view.getFrameSize().height > view.getFrameSize().width;
        if (this.levels.active) {
            const unlocked = Math.max(1, Math.min(TEST_LEVELS.length, progress.data.unlockedLevel));
            this.levelLabels.forEach((label, index) => {
                const selected = flow.selectedLevel === index + 1;
                const open = index + 1 <= unlocked;
                const current = open && selected;
                label.node.active = open;
                label.string = String(index + 1);
                label.color = current ? this.levelCurrentColor : this.levelOpenColor;
                const button = this.levelButtons[index];
                if (button) button.interactable = open;
                const frame = current ? this.levelCurrentSprite : open ? this.levelOpenSprite : this.levelClosedSprite;
                const sprite = button?.getComponent(Sprite);
                if (sprite && frame) sprite.spriteFrame = frame;
                const lock = this.levelLockNodes[index];
                if (lock) lock.active = !open;
                const stars = progress.data.best[String(index + 1)] ?? 0;
                this.levelStars[index].string = stars ? '★'.repeat(stars) : 'Не пройден';
            });
            this.levelInfo.string = `${flow.levelName}\nЦель: спасти не менее ${flow.target} из ${world.zombies.length}`;
            this.wallet.string = `Монеты: ${progress.data.coins}`;
        }

        if (this.complete.active) {
            const passed = TEST_LEVELS.filter(level => (progress.data.best[String(level)] ?? 0) > 0).length;
            this.completionText.string = `${passed === 5 ? 'Пять уровней пройдены' : 'Пятый уровень пройден'}\nПройдено уровней: ${passed} из 5\nМожно вернуться и улучшить результат${progress.available ? '' : '\nСохранение недоступно'}`;
        }
    }
    notice(message: string): void { this.hint.string = message; }
}
