import { _decorator, Component, Sprite, Enum, UITransform } from 'cc';
import { AspectRatioType } from './AspectRatioType';
const { ccclass, property } = _decorator;


@ccclass('CellsView')
export class CellsView extends Component {

    @property({ type: AspectRatioType })
    private aspectRatioType: AspectRatioType = AspectRatioType.None;

    private uiTransform;
    private imgAspectRatio;

    protected onLoad(): void {
        const sprite = this.node.getComponent(Sprite);
        this.uiTransform = this.node.getComponent(UITransform);
        if (!sprite) {
            console.error("Sprite component not found on the node.");
            return;
        }
        if (!this.uiTransform) {
            console.error("uiTransform component not found on the node.");
            return;
        }
        this.imgAspectRatio = sprite.spriteFrame.width / sprite.spriteFrame.height;

        //window.onresize = onresize;

        this.onresize();
    }

    private onresize(){
        switch (this.aspectRatioType) {
            case AspectRatioType.Width:
                this.uiTransform.setContentSize(this.uiTransform.width, this.uiTransform.width / this.imgAspectRatio);
                break;
            case AspectRatioType.Height:
                this.uiTransform.setContentSize(this.uiTransform.height * this.imgAspectRatio, this.uiTransform.height);
                break;
        }
    }

}