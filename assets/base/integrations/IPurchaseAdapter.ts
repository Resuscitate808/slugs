import { IPurchaseProduct } from "./IPurchaseProduct";

export enum PurchaseEvents {
    PurchaseSuccess = "PurchaseSuccess",
    PurchaseFailed = "PurchaseFailed"
}

export interface IPurchaseAdapter {
    initialize(): Promise<void>;
    getCatalog(): IPurchaseProduct[];
    buyItem(productId: string, isConsumable: boolean): Promise<void>;
}

export const IPurchaseAdapter = Symbol("IPurchaseAdapter");