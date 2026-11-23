import { _decorator, CCString, Component, Label } from 'cc';
import { Inject } from '../controllers/ServiceLocator';
import { ILocalizationManager, LocalizationEvent } from "./ILocalizationManager";
import { IEventBus } from '../controllers/EventBus';
const { ccclass, property } = _decorator;

@ccclass('LocalizedText')
export class LocalizedLabel extends Component {

    @property({type:CCString})
    private localizationKey:string;

    @Inject(ILocalizationManager)
    private _localizationManager: ILocalizationManager;

    @Inject(IEventBus)
    private _eventBus: IEventBus;

    private label:Label;

    start() {

        this.label = this.node.getComponent(Label);
        if (this.label != null && this.label != undefined){
            this.label.string = this._localizationManager.getLocalization(this.localizationKey);
        }
      
        this._eventBus.eventTarget.on(LocalizationEvent.LOCALIZATION_CHANGED, this.onLocalizationChanged, this);
    }

    protected onDestroy(): void {
        this._eventBus.eventTarget.off(LocalizationEvent.LOCALIZATION_CHANGED, this.onLocalizationChanged, this);
    }

    private onLocalizationChanged(){
        if (this.label != null && this.label != undefined){
            this.label.string = this._localizationManager.getLocalization(this.localizationKey);
        }
    }
}

