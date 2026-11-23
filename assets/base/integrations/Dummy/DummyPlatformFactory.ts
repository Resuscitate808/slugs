import { DummyAnalyticsAdapter } from "../Analytics/DummyAnalyticsAdapter";
import { IAnalyticsAdapter } from "../Analytics/IAnalyticsAdapter";
import { IPlatformFactory } from "../IPlatformFactory";
import { DummyAdsAdapter } from "./DummyAdsAdapter";
import { DummyLeaderboardAdapter } from "./DummyLeaderboardAdapter";
import { DummyPlatformAdapter } from "./DummyPlatformAdapter";
import { DummyPurchaseAdapter } from "./DummyPurchaseAdapter";
import { DummySaveAdapter } from "./DummySaveAdapter";


export class DummyPlatformFactory implements IPlatformFactory {
    private _catalog: any;

    constructor(catalogProducts: any) {
        this._catalog = catalogProducts;
    }

    createPlatformAdapter() { return new DummyPlatformAdapter(); }
    createSaveAdapter() { return new DummySaveAdapter(); }
    createAdsAdapter() { return new DummyAdsAdapter(); }
    createLeaderboardAdapter() { return new DummyLeaderboardAdapter(); }
    createPurchaseAdapter() { return new DummyPurchaseAdapter(this._catalog); }
    createAnalyticsAdapter(): IAnalyticsAdapter { return new DummyAnalyticsAdapter();
    }

}
