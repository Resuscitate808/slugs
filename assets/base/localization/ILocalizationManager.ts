import { Enum } from "cc";

export interface ILocalizationManager {
    initilize(): void;

    getLocalization(key: string): string;

    get currentLanguageCode(): string;

    changeLocalization(language: string): void;

    getCodeLanguages(): string[];

    getLanguages(): string[];
}

export const ILocalizationManager = Symbol("ILocalizationManager");


export enum LocalizationEvent {
    LOCALIZATION_CHANGED = "localization_changed",
}
Enum(LocalizationEvent);