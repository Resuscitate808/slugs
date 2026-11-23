import { _decorator, Button, Color, Component, Node, Sprite, SpriteFrame, tween, Tween, Vec3 } from 'cc';
import { GameAudioController } from './GameAudioController';

const { ccclass, property } = _decorator;

@ccclass('PauseSoundToggle')
export class PauseSoundToggle extends Component {
    @property(GameAudioController) audio: GameAudioController | null = null;
    @property(Button) button: Button | null = null;
    @property(Node) knob: Node | null = null;
    @property(Node) onLabel: Node | null = null;
    @property(Node) offLabel: Node | null = null;
    @property(Sprite) track: Sprite | null = null;
    @property(Sprite) logo: Sprite | null = null;
    @property(SpriteFrame) onLogo: SpriteFrame | null = null;
    @property(SpriteFrame) offLogo: SpriteFrame | null = null;
    @property({ type: Boolean, tooltip: 'Переключать музыку, а не остальные звуки' }) isMusic = false;
    @property(Color) onColor = new Color(255, 255, 255, 255);
    @property(Color) offColor = new Color(180, 180, 180, 255);
    @property onX = 47.938;
    @property offX = -47.938;

    protected onEnable(): void {
        this.button?.node.on(Button.EventType.CLICK, this.toggle, this);
        this.refresh(false);
    }

    protected onDisable(): void {
        this.button?.node.off(Button.EventType.CLICK, this.toggle, this);
        if (this.knob) Tween.stopAllByTarget(this.knob);
    }

    private toggle(): void {
        if (!this.audio) return;
        if (this.controlsMusic) this.audio.setMusicEnabled(!this.audio.musicEnabled);
        else this.audio.setEffectsEnabled(!this.audio.effectsEnabled);
        this.refresh(true);
    }

    private refresh(animate: boolean): void {
        const enabled = this.controlsMusic
            ? (this.audio?.musicEnabled ?? true)
            : (this.audio?.effectsEnabled ?? true);
        if (this.onLabel) this.onLabel.active = enabled;
        if (this.offLabel) this.offLabel.active = !enabled;
        if (this.track) {
            this.track.color = enabled ? this.onColor : this.offColor;
            this.track.grayscale = !enabled;
        }
        if (this.logo) {
            const frame = enabled ? this.onLogo : this.offLogo;
            if (frame) this.logo.spriteFrame = frame;
        }
        if (!this.knob) return;
        Tween.stopAllByTarget(this.knob);
        const position = new Vec3(enabled ? this.onX : this.offX, this.knob.position.y, this.knob.position.z);
        if (animate) tween(this.knob).to(0.18, { position }, { easing: 'quadOut' }).start();
        else this.knob.setPosition(position);
    }

    private get controlsMusic(): boolean {
        return this.isMusic || this.node.parent?.name === 'Music';
    }
}
