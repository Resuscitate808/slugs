import { _decorator, Vec2, Vec3, view } from 'cc';
const { ccclass } = _decorator;

@ccclass('MathUtil')
export class MathUtil
{
    /**
     * Преобразует значение из одного диапазона в другой
     * @param value значение которое необходимо преобразовать
     * @param oldMin минимальное значение старого диапазона
     * @param oldMax максимально значение старого диапазона
     * @param newMin минимальное значение нового диапазона
     * @param newMax максимально значение нового диапазона
     * @returns значение в новом диапозоне
     * 
     * (value - oldMin) — вычисляет, насколько value отстоит от oldMin.
     * (oldMax - oldMin) — вычисляет ширину старого диапазона.
     * ((value - oldMin) / (oldMax - oldMin)) — нормализует значение в диапазоне [0, 1].
     * (newMax - newMin) — вычисляет ширину нового диапазона.
     * ((value - oldMin) / (oldMax - oldMin)) * (newMax - newMin) — масштабирует нормализованное значение на новый диапазон.
     * + newMin — сдвигает значение на начало нового диапазона.
     */
    public static mapRange(value:number, oldMin:number, oldMax:number, newMin:number, newMax:number):number
    {
        if (oldMax - oldMin === 0)
        {
            console.warn("Старый диапазон равен нулю. Возвращено текущее значение.");
            return value;
        }
        return ((value - oldMin) / (oldMax - oldMin)) * (newMax - newMin) + newMin;
    }

    /**
     * Преобразует угол в градусах в промежуток от 0 до 360
     * @param angle угол который нужно преобразовать
     * @returns 
     */
    public static angleDegreesTo360Range(angle:number):number
    {
        if (angle >= 360)
            return angle - 360;
        else
            return angle;
    }

    /**
     * Преобразует Vec2 в Vec3
     * @param vec2 вектор
     * @returns 
     */
    public static toVec3(vec2:Vec2):Vec3
    {
        return new Vec3(vec2.x, vec2.y, 0);
    }

    /**
     * Преобразует Vec3 в Vec2
     * @param vec3 вектор
     * @returns 
     */
    public static toVec2(vec3:Vec3):Vec2
    {
        return new Vec2(vec3.x, vec3.y);
    }

    /**
     * Применяет ScaleX и ScaleY игры к переданному вектору
     * @param vec3 
     */
    public static applyGameScaleToVec3(vec3:Vec3):void
    {
        vec3.x /= view.getScaleX();
        vec3.y /= view.getScaleY();
    }

    /**
     * Применяет ScaleX и ScaleY игры к переданному вектору
     * @param vec2
     */
    public static applyGameScaleToVec2(vec2:Vec2):void
    {
        vec2.x /= view.getScaleX();
        vec2.y /= view.getScaleY();
    }

    /**
     * Клонирует вектор и возвращает его с применённым ScaleX и ScaleY игры
     * @param vec3 
     */
    public static getGameScaledVec3(vec3:Vec3):Vec3
    {
        let newVec3:Vec3 = vec3.clone();
        newVec3.x /= view.getScaleX();
        newVec3.y /= view.getScaleY();

        return newVec3;
    }

    /**
     * Клонирует вектор и возвращает его с применённым ScaleX и ScaleY игры
     * @param vec2
     */
    public static getGameScaledVec2(vec2:Vec2):Vec2
    {
        let newVec2:Vec2 = vec2.clone();
        newVec2.x /= view.getScaleX();
        newVec2.y /= view.getScaleY();

        return newVec2;
    }

    /**
     * Метод округляет в меньшую сторону до указанного разряда
     * @param num число которое нужно округлить
     * @param precision точность округления (разряд) 10-тые, 100-сотыеб 1000-тысячные
     * @returns 
     */
    public static roundDownTo(num:number, precision:number):number
    {
        return Math.floor(num / precision) * precision;
    }

    /**
     * Метод возвращает массив с указанным диапозоном чисел
     * @param start начало диапозона (включительно)
     * @param end конец диапозона (включительно)
     * @returns массив чисел [min, min + 1, ..., max]
     */
    public static rangeArray(start:number, end:number):number[]
    {
        let result:number[] = [];

        for (let i = start; i <= end; i++)
        {
            result.push(i);
        }

        return result;
    }

    /**
     * Возвращает значение числа ограниченного заданным диапазоном
     * @param value изначальное число
     * @param min минимум диапазона
     * @param max максимум диапазона
     * @returns число в даданном диапазоне
     */
    public static clamp(value: number , min: number , max: number ): number {
        return Math.min(Math.max(value, min), max);
    };
    
    /**
     * Метод опрееляет является ли число целым или дробным
     * @param value число для проверки
     * @returns true если число целое false если дробное
     */
    public static isWholeNumber(value:number):boolean
    {
        return value === Math.floor(value);
    }

    /**
     * Нормализует угол в промежуток от 0 до 359 (360)
     * @param angleDeg угол в градусах
     * @returns возвращает ное значчение угла
     */
    public static normalizeAngle(angleDeg:number):number
    {
        return ((angleDeg % 360) + 360) % 360;
    }

    /**
     * Вычисляет угол поворота ведомого круга относительно ведущего при вращении без проскальзывания. Применимо для имитации шестерёночного зацепления.
     * @param parentAngle - угол поворота ведущего круга (градусы)
     * @param parentDiameter - диаметр ведущего круга
     * @param childDiameter - диаметр ведомого круга
     * @returns угол поворота ведомого круга (градусы)
     */
    public static calculateDrivenRotation(parentAngle:number, parentDiameter:number, childDiameter:number):number
    {
        // Проверка на нулевой диаметр
        if (parentDiameter <= 0 || childDiameter <= 0)
            throw new Error("Диаметры должны быть положительными числами");
        
        return parentAngle * (parentDiameter / childDiameter);
    }

    /**
     * Угол угол в радианах поворота точки относительно другой точки
     * @param v1 Точка относительно которой ищем угол
     * @param v2 Точка для которой ищем угол
     * @returns Угол в радианах
     */
    public static getVec2RotationAngleCocos(v1:Vec2, v2:Vec2):number
    {
        const direction = v2.subtract(v1);
        const angleRadians = Math.atan2(direction.y, direction.x);

        return angleRadians;
    }

    /**
     * 
     * @param value Число необходимое округлить
     * @param fractionDigits Количество цифр после запятой. Должно быть в диапазоне от 0 до 20 включительно.
     * @returns Возвращает строку, представляющую число в системе счисления с фиксированной запятой.
     */
    public static toFloatFixed(value:number, fractionDigits:number):number
    {
        return parseFloat(value.toFixed(fractionDigits));
    }
}