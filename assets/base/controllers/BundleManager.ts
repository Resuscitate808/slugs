import { Asset, AssetManager } from "cc";

export interface IBundleManager {
    loadAsset<T extends Asset>(nameBundle: string, pathInBundle: string, type: new () => T, callback: (asset: T) => void): void;
    loadAssetInMemory<T extends Asset>(nameBundle: string, pathInBundle: string, type: new () => T, callback: (asset: T) => void): void;
}

export const IBundleManager = Symbol("IBundleManager");

export class BundleManager implements IBundleManager {
    private assetManager: AssetManager;

    constructor() {
        this.assetManager = AssetManager.instance;
    }

    public loadAsset<T extends Asset>(nameBundle: string, pathInBundle: string, type: new () => T, callback: (asset: T) => void) {
        const getBundle = this.assetManager.bundles.get(nameBundle);
        if (getBundle != null) {
            getBundle.load(pathInBundle, type, (err, asset) => {
                if (err) {
                    console.error(err);
                    return;
                }
                callback(asset as T);
            });
        } else {
            this.loadAssetInMemory<T>(nameBundle, pathInBundle, type, callback);
        }
    }

    public loadAssetInMemory<T extends Asset>(nameBundle: string, pathInBundle: string, type: new () => T, callback: (asset: T) => void) {
        this.assetManager.loadBundle(nameBundle, (error, bundle) => {
            if (error) {
                console.error(error);
                return;
            }
            bundle.load(pathInBundle, type, (err, asset) => {
                if (err) {
                    console.error(err + " " + asset);
                    return;
                }
                callback(asset as T);
            });
        });
    }
}
