import { _decorator, Canvas, Component, Node, ResolutionPolicy, screen, Size, sys, UITransform, Vec3, view } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('NodeScaler')
export class NodeScaler extends Component
{
    @property
    private useExtraScaleOnMobile:boolean = false;

    @property({visible: function(this:NodeScaler) { return this.useExtraScaleOnMobile == true }})
    private extraScale:number = 1;

    private _uiTransform:UITransform;
    private _defaultScale:number;

    private _ratioX1:number;
    private _ratioX2:number;
    private _ratioY1:number;
    private _ratioY2:number;
    private _scaleX:number;
    private _scaleY:number;
    private _newScale:number;

    onLoad()
    {
        const designResolution:Size = view.getDesignResolutionSize();

        this._uiTransform = this.node.getComponent(UITransform);
        this._defaultScale = Math.max(this._uiTransform.width / designResolution.width, this._uiTransform.height / designResolution.height);
        
        view.on('canvas-resize', this.onResize, this);
        this.onResize();
    }

    onDestroy()
    {
        view.off('canvas-resize', this.onResize, this);
    }

    private onResize():void
    {
        this._ratioX1 = screen.windowSize.width / this._uiTransform.width;
        this._ratioX2 = this._uiTransform.width / screen.windowSize.width;
        this._ratioY1 = screen.windowSize.height / this._uiTransform.height;
        this._ratioY2 = this._uiTransform.height / screen.windowSize.height;
        this._scaleX = 1;
        this._scaleY = 1;
        this._newScale = 1;

        if (screen.windowSize.width > this._uiTransform.width)
            this._scaleX = Math.max(this._ratioX1, this._ratioX2);

        if (screen.windowSize.width < this._uiTransform.width)
            this._scaleX = Math.min(this._ratioX1, this._ratioX2);

        if (screen.windowSize.height > this._uiTransform.height)
            this._scaleY = Math.max(this._ratioY1, this._ratioY2);

        if (screen.windowSize.height < this._uiTransform.height)
            this._scaleY = Math.min(this._ratioY1, this._ratioY2);

        this._newScale = Math.min(this._scaleX, this._scaleY);

        if (this.useExtraScaleOnMobile && sys.isMobile)
            this._newScale *= this.extraScale;

        // this.node.setScale(scale / view.getScaleX(), scale / view.getScaleX(), 1);
        this.node.setScale((this._defaultScale * this._newScale) / view.getScaleX(), (this._defaultScale * this._newScale) / view.getScaleX(), 1);
    }
}