import { Inject, InjectBase } from '../../controllers/ServiceLocator';
import { IPlatformAdapter } from '../IPlatformAdapter';
import { VKPlatformAdapter } from './VKPlatformAdapter';
import { IEventBus } from '../../controllers/EventBus';
import { IPurchaseAdapter, PurchaseEvents } from '../IPurchaseAdapter';
import { IPurchaseProduct } from '../IPurchaseProduct';

/**
 * Клиентская часть платежей VK (голоса).
 * Документация:
 * - https://dev.vk.ru/ru/api/payments/overview
 * - https://dev.vk.ru/ru/bridge/VKWebAppShowOrderBox
 *
 * Каталог и цены (голоса) берутся с нашего callback-сервера:
 * GET /api/v1/vk/{gameCode}/catalog
 * В окне оплаты VK цена тоже приходит с сервера через get_item.
 */
export class VKPurchaseAdapter implements IPurchaseAdapter {

    @Inject(IPlatformAdapter)
    private platformAdapter: IPlatformAdapter;

    @Inject(IEventBus)
    private eventBus: IEventBus;

    private _isPaymentsAvailable: boolean = false;
    private _catalog: IPurchaseProduct[] = [];
    private _catalogUrl: string;

    constructor(catalogUrl: string) {
        InjectBase(this);
        this._catalogUrl = catalogUrl;
    }

    public async initialize(): Promise<void> {
        const bridge = (this.platformAdapter as VKPlatformAdapter).vkBridge;

        if (!bridge) {
            console.error("### VKPurchaseAdapter: VK Bridge не инициализирован в PlatformAdapter!");
            return;
        }

        try {
            await this.loadCatalog();
            this._isPaymentsAvailable = this._catalog.length > 0;
            if (!this._isPaymentsAvailable) {
                console.warn('### VK каталог пустой, покупки недоступны');
            }
        } catch (e) {
            // Каталог опционален: без него игра должна стартовать, покупки просто выключены.
            this._isPaymentsAvailable = false;
            this._catalog = [];
            console.warn('### VK каталог не загрузился, покупки недоступны:', e);
        }
    }

    public getCatalog(): IPurchaseProduct[] {
        return this._catalog;
    }

    public async buyItem(productId: string, _isConsumable: boolean): Promise<void> {
        if (!this._isPaymentsAvailable) {
            console.error("### Покупки VK недоступны");
            this.eventBus.eventTarget.emit(PurchaseEvents.PurchaseFailed, productId);
            return;
        }

        const platform = this.platformAdapter as VKPlatformAdapter;
        const bridge = platform.vkBridge;

        if (!bridge || typeof bridge.send !== 'function') {
            console.error("### VK Bridge недоступен для покупки");
            this.eventBus.eventTarget.emit(PurchaseEvents.PurchaseFailed, productId);
            return;
        }

        try {
            const embedded = typeof bridge.isEmbedded === 'function' ? bridge.isEmbedded() : null;
            const iframe = typeof bridge.isIframe === 'function' ? bridge.isIframe() : null;
            let supportsOrderBox = true;
            if (typeof bridge.supportsAsync === 'function') {
                supportsOrderBox = await bridge.supportsAsync('VKWebAppShowOrderBox');
            } else if (typeof bridge.supports === 'function') {
                supportsOrderBox = bridge.supports('VKWebAppShowOrderBox');
            }

            if (!supportsOrderBox) {
                throw new Error('VKWebAppShowOrderBox не поддерживается на этой платформе (на VK нет iOS native)');
            }

            // type всегда 'item'; item — ID товара (до 64 символов), как в get_item на сервере.
            const data = await bridge.send('VKWebAppShowOrderBox', {
                type: 'item',
                item: productId
            });

            // Ответ Bridge: { success: true, order_id: "..." }
            if (data && data.success === true) {
                const orderId = data.order_id != null ? String(data.order_id) : '';
                this.eventBus.eventTarget.emit(PurchaseEvents.PurchaseSuccess, productId);
            } else {
                console.warn("### Статус платежа не подтвержден:", data);
                this.eventBus.eventTarget.emit(PurchaseEvents.PurchaseFailed, productId);
            }

        } catch (e) {
            console.warn("### Покупка в ВК отменена пользователем или произошла ошибка:", e);
            this.eventBus.eventTarget.emit(PurchaseEvents.PurchaseFailed, productId);
        }
    }

    private async loadCatalog(): Promise<void> {
        const response = await fetch(this._catalogUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
            throw new Error(`VK catalog HTTP ${response.status}: ${this._catalogUrl}`);
        }

        const products = await response.json();
        if (!Array.isArray(products)) {
            throw new Error('VK catalog: expected array');
        }

        this._catalog = products
            .filter((p: any) => p && p.is_active !== false && p.item_code)
            .map((p: any) => this.mapServerProduct(p));
    }

    private mapServerProduct(p: any): IPurchaseProduct {
        const votes = Number(p.price) || 0;
        return {
            id: String(p.item_code),
            title: String(p.title || p.item_code),
            description: p.description ? String(p.description) : '',
            imageURI: p.photo_url ? String(p.photo_url) : '',
            price: this.formatVotes(votes),
            priceValue: String(votes),
            priceCurrencyCode: 'votes',
        };
    }


    private formatVotes(votes: number): string {
        const n = Math.abs(Math.trunc(votes));
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod100 >= 11 && mod100 <= 14) {
            return `${n} голосов`;
        }
        if (mod10 === 1) {
            return `${n} голос`;
        }
        if (mod10 >= 2 && mod10 <= 4) {
            return `${n} голоса`;
        }
        return `${n} голосов`;
    }
}
