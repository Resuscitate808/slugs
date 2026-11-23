import { Inject, InjectBase } from '../../controllers/ServiceLocator';
import { IPlatformAdapter } from '../IPlatformAdapter';
import { YPlatformAdapter } from './YPlatformAdapter';
import { IEventBus } from '../../controllers/EventBus';
import { IPurchaseAdapter, PurchaseEvents } from '../IPurchaseAdapter';
import { IPurchaseProduct } from '../IPurchaseProduct';


export class YPurchaseAdapter implements IPurchaseAdapter {

    @Inject(IPlatformAdapter)
    private platformAdapter: IPlatformAdapter;

    @Inject(IEventBus)
    private eventBus: IEventBus;

    private _payments: any = null;
    private _catalog: IPurchaseProduct[] = null;

    constructor() {
        InjectBase(this); 
    }

    // Метод асинхронной инициализации покупок
    public async initialize(): Promise<void> {
        const ysdk = (this.platformAdapter as YPlatformAdapter).ysdk;
        
        if (!ysdk) {
            console.error("### YPurchaseAdapter: Yandex SDK не инициализирован в PlatformAdapter!");
            return;
        }

        try {
            // Инициализируем платежи Яндекса
            this._payments = await ysdk.getPayments({ signed: false });
            console.info('### Yandex Покупки успешно инициализированы в YPurchaseAdapter');

            try {
                const products = await this._payments.getCatalog();
                this._catalog = products.map((p: any) => ({
                    id: p.id,
                    title: p.title,
                    description: p.description,
                    imageURI: p.imageURI,
                    price: p.price, // Яндекс вернет готовую строку "10 Янов" или "150 руб." под регион игрока
                    priceValue: p.priceValue,
                    priceCurrencyCode: p.priceCurrencyCode
                }));
            } catch (e) {
                console.error("### Ошибка при получении каталога Яндекса:", e);
            }

            // Проверяем и закрываем зависшие транзакции при старте
            await this.checkUnconsumedPurchases();
        } catch (e) {
            this._payments = null;
            console.warn('### Покупки Яндекс Игр недоступны (возможно, выключены в Консоли):', e);
        }
    }

    // Получение списка товаров для отрисовки вашего UI магазина
    public getCatalog(): IPurchaseProduct[] {
        if (!this._catalog) {
            console.warn("### Каталог недоступен: покупки не инициализированы");
            return [];
        }
        return this._catalog;
    }

    // Вызов покупки из UI
    public async buyItem(productId: string, isConsumable: boolean): Promise<void> {
        if (!this._payments) {
            console.error("### Покупки недоступны");
            this.eventBus.eventTarget.emit(PurchaseEvents.PurchaseFailed, productId);
            return;
        }

        try {
            // Открываем оверлей Яндекса для оплаты
            const purchase = await this._payments.purchase({ id: productId });
            console.info("### Яндекс подтвердил оплату товара:", productId);

            if (isConsumable) {
                // Если товар многоразовый (золото, расходники) — сразу "потребляем" его
                await this.consumeItem(purchase.purchaseToken, productId);
            } else {
                // Если вечный (например, отключение рекламы), просто шлем событие успеха
                this.eventBus.eventTarget.emit(PurchaseEvents.PurchaseSuccess, productId);
            }
        } catch (e) {
            console.warn("### Покупка отменена пользователем или произошла ошибка:", e);
            this.eventBus.eventTarget.emit(PurchaseEvents.PurchaseFailed, productId);
        }
    }

    // Внутренний метод списания товара с сервера Яндекса
    private async consumeItem(token: string, productId: string): Promise<void> {
        try {
            await this._payments.consumePurchase(token);
            console.info(`### Товар ${productId} успешно потреблен.`);
            // Уведомляем игру, что покупка чистая и можно выдать золото/предмет в инвентарь
            this.eventBus.eventTarget.emit(PurchaseEvents.PurchaseSuccess, productId);
        } catch (e) {
            console.error(`### Критическая ошибка: не удалось потребить товар ${productId} на сервере Яндекса!`, e);
            this.eventBus.eventTarget.emit(PurchaseEvents.PurchaseFailed, productId);
        }
    }

    // Автоматическая проверка недополученных товаров при старте игры
    private async checkUnconsumedPurchases(): Promise<void> {
        try {
            const purchases = await this._payments.getPurchases();
            if (purchases && purchases.length > 0) {
                console.info(`### Найдено зависших покупок: ${purchases.length}. Начинаем выдачу...`);
                for (let purchase of purchases) {
                    try {
                        await this._payments.consumePurchase(purchase.purchaseToken);
                        console.info(`### Зависший товар ${purchase.productID} успешно выдан через авто-проверку.`);
                        
                        // Здесь мы шлем событие успеха, чтобы StoreManager или SaveManager начислили ресурсы
                        this.eventBus.eventTarget.emit(PurchaseEvents.PurchaseSuccess, purchase.productID);
                    } catch (consumeErr) {
                        console.error(`Ошибка при очистке зависшего токена для ${purchase.productID}:`, consumeErr);
                    }
                }
            }
        } catch (e) {
            console.error('Ошибка проверки зависших покупок:', e);
        }
    }
}
