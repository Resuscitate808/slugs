import { _decorator } from 'cc';
const { ccclass } = _decorator;

@ccclass('ArrayUtil')
export class ArrayUtil
{
    /**
     * Группирует массив по указанному параметру его элементов
     * 
     * // Пример использования
     * interface Point {
            x: number;
            y: number;
        }
        
        const points: Point[] = [
            { x: 1, y: 2 },
            { x: 3, y: 2 },
            { x: 5, y: 3 },
            { x: 7, y: 3 },
            { x: 9, y: 1 }
        ];

        const grouped = ArrayUtil.groupByY(points);
        console.log(grouped);

        Результат:
        [
          [{ x: 1, y: 2 }, { x: 3, y: 2 }],
          [{ x: 5, y: 3 }, { x: 7, y: 3 }],
          [{ x: 9, y: 1 }]
        ]
     *
     * @param array - массив для группировки
     * @param getKey - метод получения свойства для сортировки
     * @public запись сгруппированных массивов
     */
    public static groupByToRecord<T, K extends keyof any>(array:T[], getKey: (item:T) => K):Record<K, T[]>
    {
        return array.reduce((acc, item) =>
            {
                const key = getKey(item);
                if (!acc[key])
                    acc[key] = [];
                
                acc[key].push(item);
                return acc;
            }, {} as Record<K, T[]>);
    }

    public static groupByToArrays<T, K>(array:T[], keySelector: (item:T) => K):T[][]
    {
        const map = new Map<K, T[]>();
        
        array.forEach(item => {
            const key = keySelector(item);
            if (!map.has(key))
                map.set(key, []);
            
            map.get(key)!.push(item);
        });
        
        return Array.from(map.values());
    }
}