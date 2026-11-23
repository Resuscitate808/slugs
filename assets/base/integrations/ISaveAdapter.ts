


export interface ISaveAdapter {
    initialize(): Promise<void>;

    get save(): {[key: string]: string | number | boolean | object};
    set save(value: {[key: string]: string | number | boolean | object});
}

export const ISaveAdapter = Symbol("ISaveAdapter");