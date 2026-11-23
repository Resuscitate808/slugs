import { _decorator } from 'cc';
import { IDisposible } from '../interfaces/IDisposible';
import { Inject, InjectBase } from 'db://assets/base/controllers/ServiceLocator';
import { IAnalyticsAdapter } from '../integrations/Analytics/IAnalyticsAdapter';
import { IEventBus } from './EventBus';
import { IPurchaseAdapter, PurchaseEvents } from '../integrations/IPurchaseAdapter';

export interface IPurchaseAnalytics
{

}
export const IPurchaseAnalytics = Symbol("IPurchaseAnalytics");

export class PurchaseAnalytics implements IPurchaseAnalytics, IDisposible {
    
    @Inject(IAnalyticsAdapter)
    private analytics: IAnalyticsAdapter;

    @Inject(IEventBus)
    private eventBus: IEventBus;

    @Inject(IPurchaseAdapter)
    private purchaseAdapter: IPurchaseAdapter;

    constructor() {
        InjectBase(this);
        this.eventBus.eventTarget.on(PurchaseEvents.PurchaseSuccess, this.onPurchaseSuccess, this);
        this.eventBus.eventTarget.on(PurchaseEvents.PurchaseFailed, this.onPurchaseFailed, this);
    }

    Dispose() {
        this.eventBus.eventTarget.off(PurchaseEvents.PurchaseSuccess, this.onPurchaseSuccess, this);
        this.eventBus.eventTarget.off(PurchaseEvents.PurchaseFailed, this.onPurchaseFailed, this);
    }

    private onPurchaseSuccess(productId: string) {

        const targetProduct = this.purchaseAdapter.getCatalog().find(p => p.id === productId);

        this.analytics.send("purchase_success", {
            product_id: productId,
            product_price: targetProduct.price,
            product_currency: targetProduct.priceCurrencyCode
        });
    }

    private onPurchaseFailed(productId: string) {
        this.analytics.send("purchase_failed", {
            product_id: productId
        });
    }
}

