import { IPlatformAdapter } from './IPlatformAdapter';
import { ISaveAdapter } from './ISaveAdapter';
import { IAdsAdapter } from './IAdsAdapter';
import { ILeaderboardAdapter } from './ILeaderboardAdapter';
import { IPurchaseAdapter } from './IPurchaseAdapter';
import { IAnalyticsAdapter } from './Analytics/IAnalyticsAdapter';

export interface IPlatformFactory {
    createPlatformAdapter(): IPlatformAdapter;
    createSaveAdapter(): ISaveAdapter;
    createAdsAdapter(): IAdsAdapter;
    createLeaderboardAdapter(): ILeaderboardAdapter;
    createPurchaseAdapter(): IPurchaseAdapter;

    createAnalyticsAdapter(): IAnalyticsAdapter;
}
