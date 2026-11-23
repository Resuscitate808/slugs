import { _decorator, v3, Vec3 } from 'cc';
const { ccclass } = _decorator;

export interface IGraphNode
{
    radius:number;
    initialPos:Vec3;
    finalPos:Vec3;
    parent:IGraphNode;
}

@ccclass('ForceDirectedGraph')
export class ForceDirectedGraph
{
    private _graphNodes:IGraphNode[] = []; // IGraphNode с которыми работает алгоритм
    private _minPos:Vec3; // левый нижний угол области
    private _maxPos:Vec3; // правый верхний угол области

    // Что делает: Максимальное количество итераций алгоритма
    // Как работает: Защита от бесконечного цикла
    // Назначение: Гарантирует, что вычисления завершатся даже если граф не сошелся
    private _maxIterations:number;

    // Что делает: Сила отталкивания между узлами
    // Как работает: Чем больше значение, тем сильнее узлы отталкиваются друг от друга
    // Формула: F = repulsionForce / distance² (закон Кулона)
    // Назначение: Предотвращает пересечение узлов и создает равномерное распределение
    private _repulsionForce:number;

    // Что делает: Сила притяжения вдоль связей (жесткость пружины)
    // Как работает: Чем больше значение, тем "жестче" связи и быстрее граф сходится
    // Формула: F = springForce * (distance - targetDistance) (закон Гука)
    // Назначение: Удерживает связанные узлы на оптимальном расстоянии
    private _springForce:number;

    // Что делает: Целевое расстояние между связанными узлами
    // Как работает: К желаемому расстоянию между центрами добавляется сумма радиусов
    // Формула: targetDistance = radiusA + radiusB + springLength
    // Назначение: Определяет комфортное расстояние между соединенными узлами
    private _springLength:number;

    // Что делает: Сила отталкивания от границ прямоугольной области
    // Как работает: Чем больше значение, тем сильнее узлы отталкиваются от границ при приближении к ним. Сила пропорциональна глубине проникновения узла за границу
    // Формула: F = boundaryForce × penetrationDepth (чем глубже узел в стене, тем сильнее толчок)
    // Назначение: Удерживает узлы в пределах заданной области, предотвращая их выход за границы с учетом их радиусов
    private _boundaryForce:number;

    // Что делает: Коэффициент демпфирования (затухания)
    // Как работает: Умножает скорость на каждом шаге (0.9 = 10% потерь)
    // Диапазон: 0.0-1.0 (0 - полная остановка, 1 - нет затухания)
    // Назначение: Предотвращает бесконечные колебания и ускоряет сходимость
    private _damping:number;

    // Что делает: Порог сходимости (точность)
    // Как работает: Если максимальное смещение узлов < 0.1, алгоритм останавливается
    // Назначение: Определяет, когда граф считается "сошедшимся"
    private _convergenceThreshold:number;

    // Что делает: Максимальная скорость движения узлов
    // Как работает: Ограничивает скорость, чтобы предотвратить "разлет" графа
    // Назначение: Стабилизирует алгоритм и предотвращает резкие скачки
    private _maxVelocity:number;

    private _edges:[IGraphNode, IGraphNode][] = [];

    /**
     * Force-directed graph
     * @param graphNodes IGraphNode с которыми работает алгоритм
     * @param minPos левый нижний угол области
     * @param maxPos правый верхний угол области
     * @param maxIterations Максимальное количество итераций алгоритма
     * @param repulsionForce Сила отталкивания между узлами
     * @param springForce Сила притяжения вдоль связей (жесткость пружины)
     * @param springLength Целевое расстояние между связанными узлами
     * @param boundaryForce Сила отталкивания от границ прямоугольной области
     * @param damping Коэффициент демпфирования (затухания)
     * @param convergenceThreshold Порог сходимости (точность)
     * @param maxVelocity Максимальная скорость движения узлов
     */
    constructor(graphNodes:IGraphNode[], minPos:Vec3, maxPos:Vec3, maxIterations:number = 1000,
                repulsionForce:number = 1, springForce:number = 0.3, springLength:number = -1,
                boundaryForce:number = 1, damping:number = 0.7, convergenceThreshold:number = 0.1,
                maxVelocity:number = 5)
    {
        this._graphNodes = graphNodes;
        this._minPos = minPos;
        this._maxPos= maxPos;
        this._maxIterations= maxIterations;

        this._repulsionForce = repulsionForce;
        this._springForce = springForce;
        this._springLength = springLength;
        this._boundaryForce = boundaryForce;
        this._graphNodes = graphNodes;
        this._damping = damping;
        this._convergenceThreshold = convergenceThreshold;
        this._maxVelocity = maxVelocity;

        this.initialize();
    }

    // Инициализация свойств для всех узлов
    private initialize():void
    {
        for (let i = 0; i < this._graphNodes.length; i++)
        {
            const node:IGraphNode = this._graphNodes[i];
            node.finalPos = node.initialPos.clone();
        }
    }

    // Построение минимального остовного дерева (MST) через алгоритм Прима
    public buildMinimumSpanningTree():void
    {
        if (this._graphNodes.length === 0) return;

        const visited:Set<IGraphNode> = new Set<IGraphNode>();
        const unvisited:Set<IGraphNode> = new Set(this._graphNodes);
        const root:IGraphNode = this._graphNodes[0];
        
        visited.add(root);
        unvisited.delete(root);

        while (unvisited.size > 0)
        {
            let minDistance:number = Infinity;
            let closestNode:IGraphNode | null = null;
            let parentNode:IGraphNode | null = null;

            for (const visitedNode of visited)
            {
                for (const unvisitedNode of unvisited)
                {
                    const distance = Vec3.distance(visitedNode.initialPos, unvisitedNode.initialPos);

                    if (distance < minDistance)
                    {
                        minDistance = distance;
                        closestNode = unvisitedNode;
                        parentNode = visitedNode;
                    }
                }
            }

            if (closestNode && parentNode)
            {
                closestNode.parent = parentNode;
                this._edges.push([parentNode, closestNode]);
                visited.add(closestNode);
                unvisited.delete(closestNode);
            }
        }
    }

    // Вычисление финальных позиций
    public calculateFinalPositions():void
    {
        const positions:Vec3[] = this._graphNodes.map(node => node.initialPos.clone());
        const velocities:Vec3[] = this._graphNodes.map(() => v3(0, 0, 0));

        for (let iteration = 0; iteration < this._maxIterations; iteration++)
        {
            let maxDisplacement:number = 0;

            // Сброс ускорений
            const accelerations:Vec3[] = this._graphNodes.map(() => v3(0, 0, 0));

            // Силы отталкивания между всеми узлами
            for (let i = 0; i < this._graphNodes.length; i++)
            {
                for (let j = i + 1; j < this._graphNodes.length; j++)
                {
                    this.calculateRepulsionForce(i, j, positions, accelerations);
                }
            }

            // Силы притяжения для ребер графа
            for (const [nodeA, nodeB] of this._edges)
            {
                const indexA:number = this._graphNodes.indexOf(nodeA);
                const indexB:number = this._graphNodes.indexOf(nodeB);
                this.calculateSpringForce(indexA, indexB, positions, accelerations);
            }

            // Силы от границ для каждого узла
            for (let i = 0; i < this._graphNodes.length; i++)
            {
                this.calculateBoundaryForce(i, positions[i], accelerations[i]);
            }

            // Обновление позиций и скоростей
            for (let i = 0; i < this._graphNodes.length; i++)
            {
                // Интегрирование скорости
                velocities[i].add(accelerations[i]);
                
                // Демпфирование
                velocities[i].multiplyScalar(this._damping);
                
                // Ограничение максимальной скорости
                const speed:number = velocities[i].length();

                if (speed > this._maxVelocity)
                {
                    velocities[i].normalize().multiplyScalar(this._maxVelocity);
                }

                // Интегрирование позиции
                const displacement:Vec3 = velocities[i].clone();
                positions[i].add(displacement);

                // Отслеживание максимального смещения
                maxDisplacement = Math.max(maxDisplacement, displacement.length());
            }

            // Проверка сходимости
            if (maxDisplacement < this._convergenceThreshold)
            {
                console.info(`Граф сошелся за ${iteration + 1} итераций`);
                break;
            }

            if (iteration === this._maxIterations - 1)
            {
                console.info(`Достигнуто максимальное количество итераций: ${this._maxIterations}`);
            }
        }

        // Сохраняем финальные позиции
        for (let i = 0; i < this._graphNodes.length; i++)
        {
            this._graphNodes[i].finalPos = positions[i];
        }
    }

    // Сила отталкивания
    private calculateRepulsionForce(i:number, j:number, positions:Vec3[], accelerations:Vec3[]):void
    {
        const direction:Vec3 = v3();
        Vec3.subtract(direction, positions[i], positions[j]);
        const distance:number = direction.length();

        if (distance === 0)
            return;

        const minDistance:number = this._graphNodes[i].radius + this._graphNodes[j].radius;
        const effectiveDistance:number = Math.max(distance, minDistance);

        const forceMagnitude:number = this._repulsionForce / (effectiveDistance * effectiveDistance);
        direction.normalize().multiplyScalar(forceMagnitude);

        accelerations[i].add(direction);
        accelerations[j].subtract(direction);
    }

    // Сила пружины (притяжения)
    private calculateSpringForce(i:number, j:number, positions:Vec3[], accelerations:Vec3[]):void
    {
        const direction:Vec3 = v3();
        Vec3.subtract(direction, positions[j], positions[i]);
        const distance:number = direction.length();

        if (distance === 0)
            return;

        const minDistance:number = this._graphNodes[i].radius + this._graphNodes[j].radius + this._springLength;
        const displacement:number = distance - minDistance;

        const forceMagnitude:number = this._springForce * displacement;
        direction.normalize().multiplyScalar(forceMagnitude);

        accelerations[i].add(direction);
        accelerations[j].subtract(direction);
    }

    // Сила отталкивания от границ прямоугольной области
    private calculateBoundaryForce(i:number, position:Vec3, acceleration:Vec3):void
    {
        const node:IGraphNode = this._graphNodes[i];
        const radius:number = node.radius;
        
        // Проверка левой границы
        if (position.x - radius < this._minPos.x)
        {
            const penetration:number = this._minPos.x - (position.x - radius);
            acceleration.x += this._boundaryForce * penetration;
        }
        
        // Проверка правой границы
        if (position.x + radius > this._maxPos.x)
        {
            const penetration:number = (position.x + radius) - this._maxPos.x;
            acceleration.x -= this._boundaryForce * penetration;
        }
        
        // Проверка нижней границы
        if (position.z - radius < this._minPos.z)
        {
            const penetration:number = this._minPos.z - (position.z - radius);
            acceleration.z += this._boundaryForce * penetration;
        }
        
        // Проверка верхней границы
        if (position.z + radius > this._maxPos.z)
        {
            const penetration:number = (position.z + radius) - this._maxPos.z;
            acceleration.z -= this._boundaryForce * penetration;
        }
    }

    // Проверка сходимости (все расстояния >= суммы радиусов)
    public checkConvergence():boolean
    {
        for (let i = 0; i < this._graphNodes.length; i++)
        {
            for (let j = i + 1; j < this._graphNodes.length; j++)
            {
                const nodeA:IGraphNode = this._graphNodes[i];
                const nodeB:IGraphNode = this._graphNodes[j];
                const distance:number = Vec3.distance(nodeA.finalPos, nodeB.finalPos);
                const minDistance:number = nodeA.radius + nodeB.radius;

                if (distance < minDistance)
                {
                    console.warn(`Узлы ${i} и ${j} слишком близко: ${distance} < ${minDistance}`);
                    return false;
                }
            }
        }

        return true;
    }

    // Перестроить граф с новым корнем
    public rebuildTreeWithNewRoot(newRootIndex:number):void
    {
        if (newRootIndex >= 0 && newRootIndex < this._graphNodes.length)
        {
            this._edges = [];
            this._graphNodes.forEach(toy => {
                toy.parent = null;
            });
            
            const newRoot:IGraphNode = this._graphNodes[newRootIndex];
            this.buildTreeFromRoot(newRoot);
        }
    }

    // Построение дерева из конкретного корня
    private buildTreeFromRoot(root:IGraphNode):void
    {
        const visited:Set<IGraphNode> = new Set<IGraphNode>([root]);
        const queue:IGraphNode[] = [root];

        while (queue.length > 0)
        {
            const current:IGraphNode = queue.shift()!;
            
            let closestNode:IGraphNode | null = null;
            let minDistance:number = Infinity;

            for (const node of this._graphNodes)
            {
                if (!visited.has(node))
                {
                    const distance:number = Vec3.distance(current.initialPos, node.initialPos);

                    if (distance < minDistance)
                    {
                        minDistance = distance;
                        closestNode = node;
                    }
                }
            }

            if (closestNode)
            {
                closestNode.parent = current;
                this._edges.push([current, closestNode]);
                visited.add(closestNode);
                queue.push(closestNode);
            }
        }
    }
}