import { _decorator, Component, UITransform } from 'cc';
import { AspectRatioType } from './AspectRatioType';
const { ccclass, property } = _decorator;

@ccclass('ConstAspectRatio')
export class ConstAspectRatio extends Component {
    @property({ type: AspectRatioType})
    private aspectRatioType: AspectRatioType = AspectRatioType.None;

    @property
    private aspectRatio: number = 1;


    private uiTransform;

    protected onLoad(): void {
        
        this.uiTransform = this.node.getComponent(UITransform);
        if (!this.uiTransform) {
            console.error("uiTransform component not found on the node.");
            return;
        }

        //window.onresize = onresize;

        this.onresize();
    }

    private onresize(){
        switch (this.aspectRatioType) {
            case AspectRatioType.Width:
                this.uiTransform.setContentSize(this.uiTransform.width, this.uiTransform.width / this.aspectRatio);
                break;
            case AspectRatioType.Height:
                this.uiTransform.setContentSize(this.uiTransform.height * this.aspectRatio, this.uiTransform.height);
                break;
        }
    }
}

