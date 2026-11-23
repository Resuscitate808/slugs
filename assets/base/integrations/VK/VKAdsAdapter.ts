import { AdsEvents, IAdsAdapter } from '../IAdsAdapter';
import { Inject, InjectBase } from '../../controllers/ServiceLocator';
import { IPlatformAdapter } from '../IPlatformAdapter';
// Предполагаем, что вы создадите аналогичный платформенный адаптер для ВК
import { VKPlatformAdapter } from './VKPlatformAdapter';
import { IEventBus } from '../../controllers/EventBus';

export class VKAdsAdapter implements IAdsAdapter {

    @Inject(IPlatformAdapter)
    private platformAdapter: IPlatformAdapter;

    @Inject(IEventBus)
    private eventBus: IEventBus;

    constructor() {
        InjectBase(this);
    }

    public showRewardedAd(placementId: string) {
        const bridge = (this.platformAdapter as VKPlatformAdapter).vkBridge;

        console.log(`Реклама открыта ${placementId}`);
        this.platformAdapter.stop();
        this.eventBus.eventTarget.emit(AdsEvents.RewardedAdOpened, placementId);

        let isCompleted = false;
        let safetyTimeout: any = null;

        const completeAd = (reason: string) => {
            if (isCompleted) return;
            isCompleted = true;
            clearTimeout(safetyTimeout);
            console.log(`Реклама закрыта: ${reason} ${placementId}`);

            // Убедимся, что start() действительно вызывается
            try {
                this.platformAdapter.start();
            } catch (e) {
                console.error('Ошибка при запуске платформы:', e);
            }

            this.eventBus.eventTarget.emit(AdsEvents.RewardedAdClosed, placementId);
        };

        // Таймаут на случай, если промис зависнет (iOS)
        safetyTimeout = setTimeout(() => {
            completeAd('по таймауту');
        }, 45000);

        bridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' })
            .then((data: any) => {
                console.log('Rewarded ad result:', data);
                if (data.result) {
                    console.log(`Пользователь получил награду ${placementId}`);
                    this.eventBus.eventTarget.emit(AdsEvents.RewardedAdCompleted, placementId);
                } else {
                    console.log(`Реклама закрыта без награды ${placementId}`);
                }
            })
            .catch((error: any) => {
                console.log(`Ошибка вызова или реклама закрыта крестиком:`, error);
            })
            .finally(() => {
                // Если finally сработал — завершаем через него
                completeAd('промис завершился');
            });
    }

    public showFullscrenAd() {
        const bridge = (this.platformAdapter as VKPlatformAdapter).vkBridge;

        console.log('Реклама открыта.');
        this.platformAdapter.stop();
        this.eventBus.eventTarget.emit(AdsEvents.FullscreenAdOpened);

        bridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' })
            .then((data: any) => {
                console.log(data.result ? 'Показана и закрыта.' : 'Не показана.');
            })
            .catch((error: any) => {
                console.log('Ошибка вызова или игрок закрыл рекламу раньше времени.', error);
            })
            .finally(() => {
                this.platformAdapter.start();
                this.eventBus.eventTarget.emit(AdsEvents.FullscreenAdClosed);
            });
    }

    public async hasRewardedAd(): Promise<boolean> {
        const bridge = (this.platformAdapter as VKPlatformAdapter).vkBridge;

        try {
            const check = await bridge.send('VKWebAppCheckNativeAds', {
                ad_format: 'reward',
            });
            return !!check.result;
        } catch (e) {
            console.log('Ошибка проверки rewarded-рекламы:', e);
            return false;
        }
    }

    /**
     * В ВК баннеры (Sticky) настраиваются и показываются только через Личный Кабинет платформы.
     * Управлять их скрытием/показом динамически из кода игры (как в Яндексе) нельзя.
     * Оставляем метод пустым, чтобы не ломать интерфейс IAdsAdapter.
     */
    public async hideSticky() {
        console.log('VK не поддерживает скрытие баннеров из кода. Настройте это в панели разработчика VK.');
        return Promise.resolve();
    }
}
