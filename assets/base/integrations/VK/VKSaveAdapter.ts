import { Inject, InjectBase } from '../../controllers/ServiceLocator';
import { IPlatformAdapter } from '../IPlatformAdapter';
import { ISaveAdapter } from '../ISaveAdapter';
import { VKPlatformAdapter } from './VKPlatformAdapter';

export class VKSaveAdapter implements ISaveAdapter {

    private _save: any = {};
    private readonly SAVE_KEY = 'game_progress'; // Ключ, под которым прогресс будет лежать в облаке ВК

    @Inject(IPlatformAdapter)
    private platformAdapter: IPlatformAdapter;

    constructor() {
        InjectBase(this);
    }

    public async initialize(): Promise<void> {
        const bridge = (this.platformAdapter as VKPlatformAdapter).vkBridge;
        
        try {
            // Запрашиваем значение по нашему ключу из облачного хранилища ВК
            const data = await bridge.send('VKWebAppStorageGet', { keys: [this.SAVE_KEY] });
            
            if (data && data.keys && data.keys[0] && data.keys[0].value) {
                // Если данные есть, парсим JSON-строку обратно в объект
                this._save = JSON.parse(data.keys[0].value);
                console.info('### VK Progress successfully loaded', this._save);
            } else {
                // Если сохранений в облаке еще нет (новый игрок)
                this._save = {};
                console.info('### VK Progress not found, initialized empty object');
            }
        } catch (error) {
            console.error('### Failed to load save from VK Storage', error);
            this._save = {}; // Фолбек на пустой объект в случае сетевой ошибки
        }
    }

    public get save(): {[key: string]: string | number | boolean | object} {
        return this._save;
    }

    public set save(value: {[key: string]: string | number | boolean | object}) {
        this._save = value;
        const bridge = (this.platformAdapter as VKPlatformAdapter).vkBridge;

        try {
            // Переводим объект в строку и отправляем в облако ВК
            const stringifiedSave = JSON.stringify(this._save);
            
            bridge.send('VKWebAppStorageSet', {
                key: this.SAVE_KEY,
                value: stringifiedSave
            }).then((data: any) => {
                if (data.result) {
                    console.info('### VK Progress successfully saved');
                }
            }).catch((err: any) => {
                console.error('### Error response while saving to VK', err);
            });
        } catch (error) {
            console.error('### Failed to stringify or send save to VK', error);
        }
    }
}
