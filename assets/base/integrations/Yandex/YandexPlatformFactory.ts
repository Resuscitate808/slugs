
import { IAnalyticsAdapter } from "../Analytics/IAnalyticsAdapter";
import { JJAnalyticsAdapter } from "../Analytics/JJAnalyticsAdapter";
import { IPlatformFactory } from "../IPlatformFactory";
import { YAdsAdapter } from "./YAdsAdapter";
import { YLeaderboardAdapter } from "./YLeaderboardAdapter";
import { YPlatformAdapter } from "./YPlatformAdapter";
import { YPurchaseAdapter } from "./YPurchaseAdapter";
import { YSaveAdapter } from "./YSaveAdapter";


export class YandexPlatformFactory implements IPlatformFactory {
    createPlatformAdapter() { return new YPlatformAdapter(); }
    createSaveAdapter() { return new YSaveAdapter(); }
    createAdsAdapter() { return new YAdsAdapter(); }
    createLeaderboardAdapter() { return new YLeaderboardAdapter(); }
    createPurchaseAdapter() { return new YPurchaseAdapter(); }
    createAnalyticsAdapter(): IAnalyticsAdapter { return new JJAnalyticsAdapter();
    }
}
