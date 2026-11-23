import { _decorator, Button, Component, Label, Node } from 'cc';
import { Progress } from '../application/Progress';
import { GeneratorReward, formatCountdown } from '../application/GeneratorReward';

const { ccclass, property } = _decorator;

@ccclass('EconomyWindows')
export class EconomyWindows extends Component {
    @property(Node) insufficient!: Node;
    @property(Label) shortage!: Label;
    @property(Label) required!: Label;
    @property(Button) back!: Button;
    @property(Button) dismiss!: Button;
    @property(Button) toBattery!: Button;
    @property(Node) battery!: Node;
    @property(Button) closeBattery!: Button;
    @property(Button) claim!: Button;
    @property(Label) balance!: Label;
    @property(Label) status!: Label;
    @property(Label) timer!: Label;
    @property(Label) claimText!: Label;
    @property({ type: [Button] }) openButtons: Button[] = [];
    @property({ type: [Label] }) readinessLabels: Label[] = [];
    private progress: Progress | null = null;
    private reward: GeneratorReward | null = null;
    private returnToShortage = false;
    private cost = 0;
    private bindings: Array<{ button: Button; handler: () => void }> = [];
    private changed: () => void = () => {};
    private opened: () => void = () => {};
    private closed: () => void = () => {};
    get isOpen(): boolean { return this.insufficient.active || this.battery.active; }

    bind(progress: Progress, reward: GeneratorReward, opened: () => void, closed: () => void, changed: () => void): void {
        this.unbind();
        this.progress = progress; this.reward = reward;
        this.opened = opened; this.closed = closed; this.changed = changed;
        this.insufficient.active = false; this.battery.active = false;
        progress.onInsufficientCoins = cost => this.showShortage(cost);
        this.listen(this.back, () => this.close());
        this.listen(this.dismiss, () => this.close());
        this.listen(this.toBattery, () => this.showBattery());
        this.listen(this.closeBattery, () => this.close());
        this.listen(this.claim, () => {
            if (this.reward?.claim(Date.now())) this.changed();
            this.refresh();
        });
        this.openButtons.forEach(button => this.listen(button, () => this.showBattery()));
        this.refresh();
    }
    private listen(button: Button, handler: () => void): void {
        button.node.on(Button.EventType.CLICK, handler, this);
        this.bindings.push({ button, handler });
    }
    showShortage(cost: number): void {
        this.cost = cost;
        this.opened();
        this.battery.active = false;
        this.insufficient.setSiblingIndex(this.insufficient.parent!.children.length - 1);
        this.insufficient.active = true;
        this.refresh();
    }
    showBattery(): void {
        if (this.battery.active) return;
        this.returnToShortage = this.insufficient.active;
        this.opened();
        this.insufficient.active = false;
        this.battery.setSiblingIndex(this.battery.parent!.children.length - 1);
        this.battery.active = true;
        this.refresh();
    }
    close(): void {
        if (this.battery.active && this.returnToShortage) {
            this.returnToShortage = false;
            this.showShortage(this.cost);
            return;
        }
        this.insufficient.active = false; this.battery.active = false;
        this.returnToShortage = false;
        this.closed();
    }
    dismissAll(): void {
        this.insufficient.active = false;
        this.battery.active = false;
        this.returnToShortage = false;
        this.cost = 0;
    }
    refresh(): void {
        if (!this.progress || !this.reward) return;
        const coins = this.progress.data.coins;
        if (this.insufficient.active) {
            this.shortage.string = `Не хватает ${Math.max(0, this.cost - coins)} монет`;
            this.required.string = `Нужно ${this.cost} · есть ${coins}`;
        }
        const wait = this.reward.remaining(Date.now());
        const ready = wait ? 'Зарядка' : 'Готово';
        this.readinessLabels.forEach(label => { if (label.string !== ready) label.string = ready; });
        if (!this.battery.active) return;
        this.balance.string = `Монеты ${coins}`;
        this.status.string = wait ? 'Генератор заряжается' : `Готово ${this.reward.coins} монет`;
        this.timer.string = wait ? `Следующий сбор через ${formatCountdown(wait)}` : 'Можно забрать сейчас';
        this.claimText.string = `Забрать · ${this.reward.coins} монет`;
        this.claim.interactable = wait === 0;

    }
    unbind(): void {
        if (this.progress) this.progress.onInsufficientCoins = null;
        this.bindings.forEach(({ button, handler }) => button.node.off(Button.EventType.CLICK, handler, this));
        this.bindings.length = 0;
    }
    protected onDestroy(): void { this.unbind(); }
}
