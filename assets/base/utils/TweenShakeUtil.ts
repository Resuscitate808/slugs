import { _decorator, Component, Node, Tween, tween, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('TweenShakeUtil')
export class TweenShakeUtil extends Component {
    @property({ min: 0, max: 1000, step: 0.01, slide: true, tooltip: "Интенсивность тряски в пикселях по X" })
    public intensityX: number = 10;

    @property({ min: 0, max: 1000, step: 0.01, slide: true, tooltip: "Интенсивность тряски в пикселях по Y" })
    public intensityY: number = 10;

    @property({ min: 0, max: 1000, step: 0.01, slide: true, tooltip: "Интенсивность тряски в пикселях по Z" })
    public intensityZ: number = 10;

    @property({ tooltip: "Длительность эффекта в секундах" })
    public duration: number = 0.1;

    private _originalPosition: Vec3 = new Vec3();

    private _tween: Tween<Node>;

    private _isShaking:boolean;

    public shake(): void {
        if (this._isShaking)
            return;


        this._isShaking = true;
        this._originalPosition = new Vec3(this.node.position);

        this._tween = tween(this.node)
            .to(this.duration / 4, { position: new Vec3(this._originalPosition.x + this.intensityX, this._originalPosition.y + this.intensityY, this._originalPosition.z - this.intensityZ) }, { easing: 'linear' })
            .to(this.duration / 4, { position: new Vec3(this._originalPosition.x - this.intensityX, this._originalPosition.y - this.intensityY, this._originalPosition.z + this.intensityZ) }, { easing: 'linear' })
            .to(this.duration / 4, { position: new Vec3(this._originalPosition.x + this.intensityX, this._originalPosition.y - this.intensityY, this._originalPosition.z - this.intensityZ) }, { easing: 'linear' })
            .to(this.duration / 4, { position: new Vec3(this._originalPosition.x - this.intensityX, this._originalPosition.y + this.intensityY, this._originalPosition.z + this.intensityZ) }, { easing: 'linear' })
            .call(() => {
                this.node.setPosition(this._originalPosition);
                this._isShaking = false;
            })
            .start();
    }

    public shakeForever() {
        if (this._isShaking){
            return;
        }

        this._isShaking = true;
        
        this._tween = tween(this.node).repeatForever(tween()
            .to(this.duration / 4, { position: new Vec3(this._originalPosition.x + this.intensityX, this._originalPosition.y + this.intensityY, this._originalPosition.z - this.intensityZ) }, { easing: 'linear' })
            .to(this.duration / 4, { position: new Vec3(this._originalPosition.x - this.intensityX, this._originalPosition.y - this.intensityY, this._originalPosition.z + this.intensityZ) }, { easing: 'linear' })
            .to(this.duration / 4, { position: new Vec3(this._originalPosition.x + this.intensityX, this._originalPosition.y - this.intensityY, this._originalPosition.z - this.intensityZ) }, { easing: 'linear' })
            .to(this.duration / 4, { position: new Vec3(this._originalPosition.x - this.intensityX, this._originalPosition.y + this.intensityY, this._originalPosition.z + this.intensityZ) }, { easing: 'linear' })
            .call(() => {
                this.node.setPosition(this._originalPosition);

            }));

        this._tween.start();
    }

    public stopShake() {
        if (this._tween) {
            this._isShaking = false;
            this._tween.stop();
        }
    }
}