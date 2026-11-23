import { Inject, InjectBase } from '../../controllers/ServiceLocator';
import { IPlatformAdapter } from '../IPlatformAdapter';
import { ISaveAdapter } from '../ISaveAdapter';
import { YPlatformAdapter } from './YPlatformAdapter';

export class YSaveAdapter implements ISaveAdapter {

    private _save: any;

    @Inject(IPlatformAdapter)
    private platformAdapter: IPlatformAdapter;

    constructor() {
        InjectBase(this);
    }

    public async initialize(): Promise<void> {
        let player = (this.platformAdapter as YPlatformAdapter).player;
        let save = await player.getData();

        this._save = save;
    }

    public get save(): {[key: string]: string | number | boolean | object} {
        return this._save;
    }

    public set save(value: {[key: string]: string | number | boolean | object}) {
        this._save = value;
        let player = (this.platformAdapter as YPlatformAdapter).player;
        player.setData(this._save);
    }
}