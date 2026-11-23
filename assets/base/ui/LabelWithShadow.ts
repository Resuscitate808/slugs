import { _decorator, Color, Component, Label, Node, UITransform, v3, Vec3 } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('LabelWithShadow')
@executeInEditMode
export class LabelWithShadow extends Component
{
    @property({type:Label})
    private labelShadow:Label = null;

    @property({type:Label})
    private label:Label = null;

    @property
    public set string(value:string)
    {
        if (value === null || value === undefined)
            value = '';
        else
            value = value.toString();
        
        if (this._string === value)
            return;

        this._string = value;
        this.updateComponent();
    }

    public get string():string
    {
        return this._string;
    }

    @property
    public set fontSize(value:number)
    {
        if (this._fontSize === value) return;

        this._fontSize = value;
        this.updateComponent();
    }

    public get fontSize():number
    {
        return this._fontSize;
    }

    @property
    public set lineHeight(value:number)
    {
        if (this._lineHeight === value) return;

        this._lineHeight = value;
        this.updateComponent();
    }

    public get lineHeight():number
    {
        return this._lineHeight;
    }

    @property({type:Color})
    public set textColor(value:Readonly<Color>)
    {
        if (this._textColor.equals(value)) return;

        this._textColor.set(value);
        this.updateComponent();
    }

    public get textColor():Color
    {
        return this._textColor;
    }

    @property({type:Color})
    public set shadowColor(value:Readonly<Color>)
    {
        if (this._shadowColor.equals(value)) return;

        this._shadowColor.set(value);
        this.updateComponent();
    }

    public get shadowColor():Color
    {
        return this._shadowColor;
    }

    @property
    public set shadowOffset(value:Vec3)
    {
        if (this._shadowOffset.equals(value)) return;

        this._shadowOffset.set(value);
        this.updateComponent();
    }

    public get shadowOffset():Vec3
    {
        return this._shadowOffset;
    }

    @property({serializable:true})
    protected _string:string = "label with shadow";

    @property({serializable:true})
    protected _fontSize:number = 40;

    @property({serializable:true})
    protected _lineHeight:number = 40;

    @property({serializable:true})
    protected _shadowOffset:Vec3 = v3(0, -3, 0);

    @property({serializable:true})
    protected _textColor:Color = new Color(255, 255, 255, 255);

    @property({serializable:true})
    protected _shadowColor:Color = new Color(0, 0, 0, 255);
    
    @property({type:UITransform})
    protected currentUITransform:UITransform = null;

    @property({type:UITransform})
    protected labelUITransform:UITransform = null;
    
    onLoad()
    {
        this.updateComponent();
    }

    private updateComponent():void
    {
        this.labelShadow.string = this._string;
        this.labelShadow.fontSize = this._fontSize;
        this.labelShadow.lineHeight = this._lineHeight;
        this.labelShadow.color = this._shadowColor;
        this.labelShadow.outlineColor = this._shadowColor;
        this.labelShadow.node.position = this._shadowOffset;

        this.label.string = this._string;
        this.label.fontSize = this._fontSize;
        this.label.lineHeight = this._lineHeight;
        this.label.color = this._textColor;
        this.label.outlineColor = this._shadowColor;

        this.currentUITransform.setContentSize(this.labelUITransform.contentSize);
    }
}