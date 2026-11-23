import { _decorator, Component, Enum, Node, Quat, tween, Tween } from 'cc';
const { ccclass, property } = _decorator;

export enum DeviceOrientation
{
    PORTRAIT,
    LANDSCAPE,
}
Enum(DeviceOrientation);

export class OrientationIndicatorAngle
{
    public value:number = 0;
}

@ccclass('OrientationIndicator')
export class OrientationIndicator extends Component
{
    @property({type:Node})
    private icon:Node = null;

    @property({type:Node})
    private back:Node;

    @property({type:Node})
    private body:Node;

    private _indicatorAngle:OrientationIndicatorAngle = new OrientationIndicatorAngle();
    private _tween:Tween<OrientationIndicatorAngle>;

    onLoad()
    {
        this.back.active = false;
        this.body.active = false;
        window.addEventListener('resize', this.onResize);

        this.onResize();
    }

    onDestroy()
    {
        this.stopTween();
        window.removeEventListener('resize', this.onResize);
    }

    update(deltaTime:number)
    {
        if (!this._tween || !this._indicatorAngle || !this.icon)
            return;

        this.icon.rotation = Quat.fromEuler(new Quat(), 0, 0, this._indicatorAngle.value);
    }

    private getOrientation():DeviceOrientation
    {
        return window.innerWidth > window.innerHeight ? DeviceOrientation.LANDSCAPE : DeviceOrientation.PORTRAIT;
    }

    private onResize = () =>
    {
        if (this.getOrientation() == DeviceOrientation.PORTRAIT && !this.body.active)
        {   
            this._indicatorAngle.value = 45;
            this.body.active = true;
            this.back.active = true;
            this.stopTween();
            this._tween = tween(this._indicatorAngle)
            .repeatForever(
                tween()
                .to(0.8, { value: 135 }, { easing: 'linear' })
                .delay(0.2)
                .call(() => { this._indicatorAngle.value = 45; })
                .delay(0.2)
            )
            .start()
        }
        else
        {
            this.stopTween();
            this.back.active = false;
            this.body.active = false;
        }
    }

    private stopTween():void
    {
        if (this._tween)
        {
            this._tween.stop();
            this._tween = null;
        }
    }
}