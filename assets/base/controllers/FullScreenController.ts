import { _decorator, Enum, screen } from 'cc';
import { Inject, InjectBase } from './ServiceLocator';
import { IEventBus } from './EventBus';

export enum FullScreenEvent
{
    FULLSCREEN_ENTER = "fullscreen_enter",
    FULLSCREEN_EXIT = "fullscreen_exit",
    FULLSCREEN_CHANGED = "fullscreen_changed",
}
Enum(FullScreenEvent);

export interface IFullScreenController
{
    isFullscreen():boolean;
    isSupports():boolean;
    toggleFullscreen():void;
}
export const IFullScreenController = Symbol("IFullScreenController");

export class FullScreenController implements IFullScreenController
{
    @Inject(IEventBus)
    private eventBus!: IEventBus

    constructor()
    {
        InjectBase(this);
    }

    public isFullscreen():boolean
    {
        if (this.isSupports)
            return screen.fullScreen();
        
        return false;
    }
    
    public isSupports():boolean
    {
        return screen.supportsFullScreen;
    }

    public toggleFullscreen():void
    {
        if (!this.isSupports)
        {
            console.warn("Полноэкранный режим не поддерживается!")
            return;
        }
        
        if (this.isFullscreen())
        {
            screen.exitFullScreen().then(() => {
                this.eventBus.eventTarget.emit(FullScreenEvent.FULLSCREEN_EXIT);
                this.eventBus.eventTarget.emit(FullScreenEvent.FULLSCREEN_CHANGED);
            });
        }
        else
        {
            screen.requestFullScreen().then(() => {
                this.eventBus.eventTarget.emit(FullScreenEvent.FULLSCREEN_ENTER);
                this.eventBus.eventTarget.emit(FullScreenEvent.FULLSCREEN_CHANGED);
            });
        }
    };
}