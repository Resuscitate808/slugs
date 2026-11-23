import { AdsEvents, IAdsAdapter } from '../IAdsAdapter';
import { Inject, InjectBase } from '../../controllers/ServiceLocator';
import { IPlatformAdapter } from '../IPlatformAdapter';
import { YPlatformAdapter } from './YPlatformAdapter';
import { IEventBus } from '../../controllers/EventBus';

export class YAdsAdapter implements IAdsAdapter {

    @Inject(IPlatformAdapter)
    private platformAdapter: IPlatformAdapter;

    @Inject(IEventBus)
    private eventBus: IEventBus;

    constructor() {
        InjectBase(this);
    }

    public showRewardedAd(placementId: string) {

        const ysdk = (this.platformAdapter as YPlatformAdapter).ysdk

        ysdk.adv.showRewardedVideo({
            callbacks: {
                onOpen: () => {
                    console.log(`Реклама открыта ${placementId}`);
                    this.platformAdapter.stop();
                    this.eventBus.eventTarget.emit(AdsEvents.RewardedAdOpened, placementId);
                },
                onRewarded: () => {
                    console.log(`Пользователь получил награду ${placementId}`);
                    this.eventBus.eventTarget.emit(AdsEvents.RewardedAdCompleted, placementId);
                },
                onClose: (wasShown) => {
                    console.log(`Реклама закрыта ${placementId}`);
                    this.platformAdapter.start();
                    this.eventBus.eventTarget.emit(AdsEvents.RewardedAdClosed, placementId);
                },
                onError: (error) => console.log('Ошибка вызова.'),
            }
        });
    }

    public showFullscrenAd() {
        const ysdk = (this.platformAdapter as YPlatformAdapter).ysdk;

        ysdk.adv.showFullscreenAdv({
            callbacks: {
                onOpen: () => {
                    console.log('Реклама открыта.');
                    this.platformAdapter.stop();
                    this.eventBus.eventTarget.emit(AdsEvents.FullscreenAdOpened);
                },
                onClose: (wasShown) => {
                    console.log(wasShown ? 'Показана и закрыта.' : 'Не показана.');
                    this.platformAdapter.start();
                    this.eventBus.eventTarget.emit(AdsEvents.FullscreenAdClosed);
                },
                onError: (error) => console.log('Ошибка вызова.'),
            }
        })
    }

    public hasRewardedAd(): Promise<boolean> {
        return Promise.resolve(true);
    }

    public async hideSticky() {

        const ysdk = (this.platformAdapter as YPlatformAdapter).ysdk;

        const { stickyAdvIsShowing, reason } = await ysdk.adv.getBannerAdvStatus();
        if (stickyAdvIsShowing) {
            ysdk.adv.hideBannerAdv();
        }
    }
}