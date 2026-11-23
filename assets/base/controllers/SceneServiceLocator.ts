import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

export class SceneServiceLocator {
    private services = new Map<string | symbol, any>();

    public register<T>(key: string | symbol, service: T): void {
        this.services.set(key, service);
    }

    public resolve<T>(key: string | symbol): T | undefined {
        return this.services.get(key) as T | undefined;
    }
}

