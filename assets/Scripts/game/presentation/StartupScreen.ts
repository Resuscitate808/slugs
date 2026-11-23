import { _decorator, Button, Component, Label, Node } from 'cc';
const { ccclass, property } = _decorator;

/** Persistent scene-authored loading/error overlay, reused on retry. */
@ccclass('StartupScreen')
export class StartupScreen extends Component {
    @property(Node) panel!: Node;
    @property(Label) status!: Label;
    @property(Button) retryButton!: Button;
    private onRetry: (() => void) | null = null;
    bind(onRetry: () => void): void {
        this.unbind();
        this.onRetry = onRetry;
        this.retryButton.node.on(Button.EventType.CLICK, this.retry, this);
    }
    private retry(): void { this.onRetry?.(); }
    show(message: string, error: boolean): void {
        this.status.string = message;
        this.retryButton.node.active = error;
        this.panel.active = true;
    }
    hide(): void { this.panel.active = false; }
    unbind(): void {
        this.retryButton?.node.off(Button.EventType.CLICK, this.retry, this);
        this.onRetry = null;
    }
    protected onDestroy(): void { this.unbind(); }
}
