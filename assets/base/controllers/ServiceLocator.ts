import { Component, director, Scene} from 'cc';
import { SceneServiceLocator } from './SceneServiceLocator';


// ServiceLocator.ts
export class ServiceLocator {
    private static _instance: ServiceLocator;
    private services = new Map<string | symbol, any>();
    private static sceneLocators = new WeakMap<Scene, SceneServiceLocator>();

    private constructor() {}

    public static get instance(): ServiceLocator {
        if (!this._instance) {
            this._instance = new ServiceLocator();
        }
        return this._instance;
    }

    public static getSceneLocator(scene?: Scene): SceneServiceLocator {
        if (!scene) scene = director.getScene();
        if (!scene) throw new Error('No active scene');
        let locator = this.sceneLocators.get(scene);
        if (!locator) {
            locator = new SceneServiceLocator();
            this.sceneLocators.set(scene, locator);
        }
        return locator;
    }

    public register<T>(key: string | symbol, service: T): void {
        this.services.set(key, service);
    }

    public resolve<T>(key: string | symbol): T {
        // 1. Сначала ищем в локальном контейнере сцены
        const scene = director.getScene();
        if (scene) {
            const sceneLocator = ServiceLocator.getSceneLocator(scene);
            const local = sceneLocator.resolve<T>(key);
            if (local !== undefined) return local;
        }
        // 2. Потом в глобальном
        const s = this.services.get(key);
        if (!s) {
            throw new Error(`Service ${String(key)} not found`);
        }
        return s as T;
    }
}


/**
 * Декоратор @Inject(key)
 * key может быть строкой, symbol или любым ключом, который использует ваш ServiceLocator
 */
export function Inject(key: string | symbol) {
    return function (target: any, propertyKey: string) {

        // регистрируем поле для инъекции в прототипе
        if (!target.__injections) 
            target.__injections = {};
        target.__injections[propertyKey] = key;

        if (target instanceof Component || target.__isCCClass) {
            
            const originalOnLoad = target.onLoad;

            target.onLoad = function (...args: any[]) {
                // пробегаем по цепочке прототипов, собираем все __injections
                let proto = this.constructor.prototype;
                while (proto && proto !== Object.prototype) {
                    const injections = proto.__injections;
                    if (injections) {
                        for (const prop of Object.keys(injections)) {
                            try {
                                // если экземпляр уже имеет собственное значение (например, задано в инспекторе),
                                // то не перезаписываем его — это позволяет переопределять значение в инспекторе.
                                const hasOwn = Object.prototype.hasOwnProperty.call(this, prop);
                                const current = (this as any)[prop];
                                if (!hasOwn || current === undefined || current === null) {
                                    // разрешаем из ServiceLocator - оборачиваем в try/catch чтобы не ломать создание объекта
                                    const resolved = ServiceLocator.instance.resolve(injections[prop]);
                                    Object.defineProperty(this, prop, {
                                        value: resolved,
                                        writable: true,
                                        enumerable: true,
                                        configurable: true
                                    });
                                }
                            } catch (e) {
                                console.error(`[Inject] failed to resolve ${String(injections[prop])} for property ${prop}`, e);
                            }
                        }
                    }
                    proto = Object.getPrototypeOf(proto);
                }

                // вызываем оригинальный __preload если был
                if (typeof originalOnLoad === "function") {
                    originalOnLoad.apply(this, args);
                }
            };
        }
    };
}


export function InjectBase(instance: any) {
    let proto = Object.getPrototypeOf(instance);

    while (proto && proto !== Object.prototype) {
        if (proto.__injections) {
            for (const prop of Object.keys(proto.__injections)) {
                if (Object.prototype.hasOwnProperty.call(instance, prop)) {
                    const resolved = ServiceLocator.instance.resolve(proto.__injections[prop]);
                    Object.defineProperty(instance, prop, {
                        value: resolved,
                        writable: true,
                        enumerable: true,
                        configurable: true
                    });
                }
            }
        }
        proto = Object.getPrototypeOf(proto);
    }
}

