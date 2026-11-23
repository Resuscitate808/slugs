import { IEventBus } from "../../controllers/EventBus";
import { Inject, InjectBase } from "../../controllers/ServiceLocator";
import { IPurchaseAdapter, PurchaseEvents } from "../IPurchaseAdapter";
import { IPurchaseProduct } from "../IPurchaseProduct";


export class DummyPurchaseAdapter implements IPurchaseAdapter {
    @Inject(IEventBus)
    private eventBus: IEventBus;

    private _catalog: IPurchaseProduct[];

    constructor(catalog: IPurchaseProduct[]) {
        InjectBase(this);
        this._catalog = catalog;
    }

    public async initialize(): Promise<void> {
        return Promise.resolve();
    }

    public getCatalog(): IPurchaseProduct[] {
        return this._catalog;
    }

    public async buyItem(productId: string, isConsumable: boolean): Promise<void> {
        setTimeout(() => {
            this.eventBus.eventTarget.emit(PurchaseEvents.PurchaseSuccess, productId);
            return Promise.resolve();
        }, 500);
    }
}

