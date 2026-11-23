import { _decorator, Button, Component, Label, Sprite, UITransform } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('FallenRow')
export class FallenRow extends Component {
    @property({ type: Sprite }) picture!: Sprite;
    @property({ type: UITransform }) pictureTransform!: UITransform;
    @property({ type: Label }) title!: Label;
    @property({ type: Label }) reviveLabel!: Label;
    @property({ type: Button }) reviveButton!: Button;
}
