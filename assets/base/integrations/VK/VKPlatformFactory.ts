
import { IAnalyticsAdapter } from "../Analytics/IAnalyticsAdapter";
import { JJAnalyticsAdapter } from "../Analytics/JJAnalyticsAdapter";
import { IPlatformFactory } from "../IPlatformFactory";
import { VKAdsAdapter } from "./VKAdsAdapter";
import { VKLeaderboardAdapter } from "./VKLeaderboardAdapter";
import { VKPlatformAdapter } from "./VKPlatformAdapter";
import { VKPurchaseAdapter } from "./VkPurchaseAdapter";
import { VKSaveAdapter } from "./VKSaveAdapter";


export class VKPlatformFactory implements IPlatformFactory {
    private _catalogUrl: string;

    constructor(catalogUrl: string) {
        this._catalogUrl = catalogUrl;
    }

    createPlatformAdapter() { return new VKPlatformAdapter(); }
    createSaveAdapter() { return new VKSaveAdapter(); }
    createAdsAdapter() { return new VKAdsAdapter(); }
    createLeaderboardAdapter() { return new VKLeaderboardAdapter(); }
    createPurchaseAdapter() { return new VKPurchaseAdapter(this._catalogUrl); }
    createAnalyticsAdapter(): IAnalyticsAdapter { return new JJAnalyticsAdapter();
    }
}
