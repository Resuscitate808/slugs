import { RandomUtil } from '../../utils/RandomUtil';
import { IPlatformAdapter } from '../IPlatformAdapter';

export class DummyPlatformAdapter implements IPlatformAdapter {
    public async initialize(): Promise<void> {
        // No initialization needed for dummy platform adapter
    }

    public getLanguageCode(): string {
        return "ru"; // Default language code for dummy platform adapter
    }

    public getPlayerId(): string {
        return RandomUtil.randomString(8);
    }

    public isAuthorized(): boolean {
        return true; // Always authorized for dummy platform adapter
    }

    public async authorize(): Promise<void> {
        // No authorization needed for dummy platform adapter
    }

    public ready() {
        // Always ready for dummy platform adapter
    }
    public start() {
        // No specific start logic for dummy platform adapter
    }
    public stop() {
        // No specific stop logic for dummy platform adapter
    }   
}