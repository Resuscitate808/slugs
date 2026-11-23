declare const YaGames:any;

import { IPlatformAdapter } from '../IPlatformAdapter';

export class YPlatformAdapter implements IPlatformAdapter {
    private _ysdk: any;
    private _player: any;

    public get ysdk() {
        return this._ysdk;
    }
    public get player() {
        return this._player;
    }

    public async initialize(): Promise<void> {

        const ysdk = await YaGames.init();
        let player = await ysdk.getPlayer();

        console.info('### YandexGamesSDK initialized');
        this._ysdk = ysdk;
        this._player = player;
    }

    public isAuthorized(): boolean {
        return this._player && this._player.isAuthorized();
    }

    public async authorize(): Promise<void> {

        try {
            // Игрок не авторизован.
            if (!this.isAuthorized()) {
                try {
                    // Открытие окна авторизации.
                    await this._ysdk.auth.openAuthDialog();

                    const authorizedPlayer = await this._ysdk.getPlayer();

                    this._player = authorizedPlayer;
                } catch (e) {
                    // Ошибка при авторизации игрока или повторной инициализации объекта Player.
                }
            }
            // Игрок успешно авторизован.
        } catch (err) {
            // Ошибка при инициализации объекта Player.
        }
    }

    public getLanguageCode(): string {
        return this._ysdk.environment.i18n.lang;
    }

    public getPlayerId(): string {
        return this._player.getUniqueID();
    }

    public ready() {
        this._ysdk.features.LoadingAPI?.ready();
    }

    public start() {
        this._ysdk.features.GameplayAPI?.start();
    }

    public stop() {
        this._ysdk.features.GameplayAPI?.stop();
    } 
}