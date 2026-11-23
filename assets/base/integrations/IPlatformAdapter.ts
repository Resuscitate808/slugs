export interface IPlatformAdapter {

    initialize(): Promise<void>;

    getLanguageCode(): string;

    getPlayerId(): string;
    
    ready();

    start();
    stop();

    isAuthorized(): boolean;
    authorize(): Promise<void>;
}

export const IPlatformAdapter = Symbol("IPlatformAdapter");