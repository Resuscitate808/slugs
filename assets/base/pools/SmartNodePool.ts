import { _decorator, Node, Prefab, instantiate } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;


export class SmartNodePool {
    private _prefab: Prefab;
    private _pool: Node[] = [];

  
    constructor(prefab: Prefab, initialCapacity: number = 0) {
        this._prefab = prefab;
        
        if (initialCapacity > 0) {
            this.warmup(initialCapacity);
        }
    }

    /**
     * Предварительно создает объекты в пуле для предотвращения лагов в игре
     */
    public warmup(count: number): void {
        if (!this._prefab) {
            console.error("SmartNodePool: Префаб не задан, невозможно прогреть пул!");
            return;
        }

        for (let i = 0; i < count; i++) {
            this._pool.push(this.createNewInstance());
        }
    }

    /**
     * Получить ноду из пула. Если пул пуст, создаст новую.
     * @param parent Необязательно: родительский узел, к которому сразу прикрепится нода
     */
    public get(parent: Node | null = null): Node {
        let node: Node;

        if (this._pool.length > 0) {
            node = this._pool.pop()!;
        } else {
            node = this.createNewInstance();
        }

        if (parent) {
            node.setParent(parent);
        }

        node.active = true; // Активируем перед выдачей в игру
        return node;
    }

    /**
     * Вернуть ноду обратно в пул. Спит, не рендерится, не жрет ресурсы.
     */
    public release(node: Node): void {
        if (!node) return;

        node.active = false; // КРИТИЧНО: выключает апдейты, физику и рендер
        node.removeFromParent(); // Убирает со сцены
        
        this._pool.push(node);
    }

    /**
     * Полная очистка пула и уничтожение всех нод в памяти
     */
    public clear(): void {
        for (let i = 0; i < this._pool.length; i++) {
            if (this._pool[i] && this._pool[i].isValid) {
                this._pool[i].destroy();
            }
        }
        this._pool = [];
    }

    /**
     * Внутренний метод создания «спящей» ноды
     */
    private createNewInstance(): Node {
        let node = instantiate(this._prefab);
        node.active = false;
        return node;
    }
}


