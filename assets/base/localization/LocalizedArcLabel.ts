import { _decorator, CCString, Component, Node } from 'cc';
import { ILocalizationManager, LocalizationEvent } from './ILocalizationManager';
import { Inject } from '../controllers/ServiceLocator';
import { IEventBus } from '../controllers/EventBus';
import { ArcLabel } from '../ui/ArcLabel';
const { ccclass, property } = _decorator;

@ccclass('LocalizedArcLabel')
export class LocalizedArcLabel extends Component
{
    @property({type:CCString})
    private localizationKey:string;

    @Inject(ILocalizationManager)
    private _localizationManager: ILocalizationManager;

    @Inject(IEventBus)
    private _eventBus: IEventBus;

    private label:ArcLabel;

    start() {

        this.label = this.node.getComponent(ArcLabel);
        if (this.label != null && this.label != undefined){
            this.label.text = this._localizationManager.getLocalization(this.localizationKey);
        }
        
        this._eventBus.eventTarget.on(LocalizationEvent.LOCALIZATION_CHANGED, this.onLocalizationChanged, this);
    }

    protected onDestroy(): void {
        this._eventBus.eventTarget.off(LocalizationEvent.LOCALIZATION_CHANGED, this.onLocalizationChanged, this);
    }

    private onLocalizationChanged(){
        if (this.label != null && this.label != undefined){
            this.label.text = this._localizationManager.getLocalization(this.localizationKey);
        }
    }
}