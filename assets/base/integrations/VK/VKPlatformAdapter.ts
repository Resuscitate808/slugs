declare const vkBridge: any;

import { IPlatformAdapter } from '../IPlatformAdapter';

export class VKPlatformAdapter implements IPlatformAdapter {
    private _vkBridge: any;
    private _playerInfo: any = null;
    private _bridgeReady: boolean = false;

    public get vkBridge() {
        return this._vkBridge;
    }

    public get isBridgeReady(): boolean {
        return this._bridgeReady;
    }

    public get player() {
        return this._playerInfo;
    }

    public async initialize(): Promise<void> {
        await this.waitForBridgeScript();
        this._vkBridge = this.resolveBridge();

        if (!this._vkBridge || typeof this._vkBridge.send !== 'function') {
            throw new Error('VK Bridge script loaded, but send() is unavailable');
        }


        // Без успешного Init платёжное окно часто «висит» без get_item.
        const data = await this._vkBridge.send('VKWebAppInit', {});
        this._bridgeReady = true;

        await this.fetchPlayerInfo();
    }

    private async waitForBridgeScript(): Promise<void> {
        if (typeof (window as any).vkBridge !== 'undefined' || typeof (window as any).vkConnect !== 'undefined') {
            return;
        }

        await new Promise<void>((resolve, reject) => {
            const started = Date.now();
            const checkTimer = setInterval(() => {
                if (typeof (window as any).vkBridge !== 'undefined' || typeof (window as any).vkConnect !== 'undefined') {
                    clearInterval(checkTimer);
                    resolve();
                    return;
                }
                if (Date.now() - started > 15000) {
                    clearInterval(checkTimer);
                    reject(new Error('VK Bridge script load timeout'));
                }
            }, 50);
        });
    }

    private resolveBridge(): any {
        const raw = (window as any).vkBridge ?? (window as any).vkConnect;
        if (!raw) {
            return null;
        }
        if (typeof raw.send === 'function') {
            return raw;
        }
        if (raw.default && typeof raw.default.send === 'function') {
            return raw.default;
        }
        return raw;
    }

    public isAuthorized(): boolean {
        return this._playerInfo !== null;
    }

    public async authorize(): Promise<void> {
        if (!this.isAuthorized()) {
            await this.fetchPlayerInfo();
        }
    }

    public getLanguageCode(): string {
        if (this._playerInfo && this._playerInfo.language) {
            return typeof this._playerInfo.language === 'string' ? this._playerInfo.language : 'ru';
        }

        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('vk_language') || 'ru';
    }

    public getPlayerId(): string {
        return this._playerInfo ? this._playerInfo.id.toString() : '';
    }

    private async fetchPlayerInfo(): Promise<void> {
        try {
            const userInfo = await this._vkBridge.send('VKWebAppGetUserInfo', {});
            this._playerInfo = userInfo;
        } catch (error) {
            console.error('### Failed to fetch VK user info', error);
            this._playerInfo = null;
        }
    }

    public ready() {
        console.log('VKPlatform: ready called (no-op)');
    }

    public start() {
        console.log('VKPlatform: start called (no-op)');
    }

    public stop() {
        console.log('VKPlatform: stop called (no-op)');
    }
}
