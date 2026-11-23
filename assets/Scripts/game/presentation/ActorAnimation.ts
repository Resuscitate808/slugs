import { _decorator, Component, Animation } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ActorAnimation')
export class ActorAnimation extends Component {
    @property({ type: Animation }) animation: Animation | null = null;
    @property idle = 'Idle';
    @property walking = 'Walk';
    @property stuck = 'Stuck';
    @property fallen = 'Fall';
    @property eating = 'Eat';
    @property dead = 'Death';
    private current = '';
    apply(state: string): void {
        if (this.current === state) return;
        this.current = state;
        const clips: Record<string, string> = { idle: this.idle, walking: this.walking, stuck: this.stuck, fallen: this.fallen, eating: this.eating, dead: this.dead };
        const name = clips[state];
        if (this.animation && name && this.animation.clips.some(clip => clip?.name === name)) this.animation.play(name);
    }
    reset(): void { this.current = ''; }
}
