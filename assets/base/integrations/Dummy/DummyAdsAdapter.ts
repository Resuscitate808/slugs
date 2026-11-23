import { AdsEvents, IAdsAdapter } from '../IAdsAdapter';
import { Inject, InjectBase } from '../../controllers/ServiceLocator';
import { IEventBus } from '../../controllers/EventBus';

export class DummyAdsAdapter implements IAdsAdapter {

    @Inject(IEventBus)
    private eventBus: IEventBus;

    constructor() {
        InjectBase(this); 
    }

    public hasRewardedAd(): Promise<boolean> {
       return Promise.resolve(true);
    }

    public async showRewardedAd(placementId: string) {
        console.log(`Показать вознаграждаемую рекламу ${placementId}`);
        this.eventBus.eventTarget.emit(AdsEvents.RewardedAdOpened, placementId);
        setTimeout(() => {
            this.eventBus.eventTarget.emit(AdsEvents.RewardedAdCompleted, placementId);
            this.eventBus.eventTarget.emit(AdsEvents.RewardedAdClosed, placementId);
        }, 1000);

    }

    public async showFullscrenAd() {
        console.log('Показать полноэкранную рекламу');
        this.eventBus.eventTarget.emit(AdsEvents.FullscreenAdOpened);
        setTimeout(() => {
            this.eventBus.eventTarget.emit(AdsEvents.FullscreenAdClosed);
        }, 1000);
    }
    
    public hideSticky() {
    }
}