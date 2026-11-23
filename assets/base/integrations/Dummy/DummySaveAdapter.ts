import { ISaveAdapter } from '../ISaveAdapter';

export class DummySaveAdapter implements ISaveAdapter {

    private _save: any = {};

    public async initialize(): Promise<void> {
        // No initialization needed for dummy save adapter
    }

    public get save() {
        return this._save;
    }

    public set save(value: {string: string | number | boolean | object}) {
        this._save = value;
    }
}