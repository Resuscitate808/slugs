import { _decorator, Button, CCFloat, CCString, Component } from 'cc';
import { IAudioController } from '../../../controllers/IAudioController';
import { Inject } from '../../../controllers/ServiceLocator';
const { ccclass, property } = _decorator;

@ccclass('ButtonClickSound')
export class ButtonClickSound extends Component {
    @property({type:CCString})
    private soundType:string;

    @property({type:CCFloat})
    private volume:number;

    @Inject(IAudioController)
    private audioController!: IAudioController;

    private button:Button;

    protected onLoad(): void {
        this.button = this.getComponent(Button);
        this.button.node.on(Button.EventType.CLICK, this.buttonCLicked, this);
    }

    protected onDestroy(): void {
        this.button.node?.off(Button.EventType.CLICK, this.buttonCLicked, this);
    }

    private buttonCLicked(){
        this.audioController.playEffect(this.soundType, this.volume);
    }
}

