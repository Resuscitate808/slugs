import { _decorator, Component, Sprite, SpriteFrame } from 'cc';
import { FullScreenEvent, IFullScreenController } from './../../../controllers/FullScreenController';
import { Inject } from '../../../controllers/ServiceLocator';
import { IEventBus } from '../../../controllers/EventBus';
const { ccclass, property } = _decorator;

@ccclass('FullScreenButton')
export class FullScreenButton extends Component
{
    @property({type:Sprite})
    private icon:Sprite = null;

    @property({type:SpriteFrame})
    private fullscreenOnIcon:SpriteFrame = null;

    @property({type:SpriteFrame})
    private fullscreenOffIcon:SpriteFrame = null;


    @Inject(IEventBus)
    private eventBus!: IEventBus;

    @Inject(IFullScreenController)
    private fullScreenController!: IFullScreenController;

    onLoad()
    {
        this.eventBus.eventTarget.on(FullScreenEvent.FULLSCREEN_CHANGED, this.onFullscreenChanged, this);

        this.onFullscreenChanged();
    }

    onDestroy()
    {
        this.eventBus.eventTarget.off(FullScreenEvent.FULLSCREEN_CHANGED, this.onFullscreenChanged, this);
    }

    private onFullscreenChanged = () =>
    {
        this.icon.spriteFrame = this.fullScreenController.isFullscreen() ? this.fullscreenOffIcon : this.fullscreenOnIcon;
    }

    private toggleFullscreen():void
    {
        this.fullScreenController.toggleFullscreen();
    }
}