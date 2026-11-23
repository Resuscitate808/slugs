import { _decorator, color, Color, Component, Enum, Graphics, quat, Quat, v3, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

export enum AxisDirection
{
    FORWARD_NEGATIVE_Z = 0,
    BACK_POSITIVE_Z = 1,
    RIGHT_POSITIVE_X = 2,
    LEFT_NEGATIVE_X = 3,
    UP_POSITIVE_Y = 4,
    DOWN_NEGATIVE_Y = 5
}
Enum(AxisDirection);

@ccclass('BSplineData')
export class BSplineData
{
    public position:Vec3 = v3(0, 0, 0); // координаты точки на сплайне
    public tangent:Vec3 = v3(1, 0, 0);  // вектор направления движения (касательная)
    public rotation:Quat = quat();      // кватернион поворота для ориентации объекта
    public normal:Vec3 = v3(0, 1, 0);   // нормальный вектор (обычно "вверх")
    public binormal:Vec3 = v3(1, 0, 0); // бинормальный вектор (перпендикуляр к tangent и normal)

    constructor(position:Vec3 = v3(0, 0, 0), tangent:Vec3 = v3(1, 0, 0), rotation:Quat = quat(), normal:Vec3 = v3(0, 1, 0), binormal:Vec3 = v3(0, 0, 1))
    {
        this.position = position;
        this.tangent = tangent;
        this.rotation = rotation;
        this.normal = normal;
        this.binormal = binormal;
    }
}

@ccclass('BSpline3D')
export class BSpline3D extends Component
{
    public static readonly GEOMETRY_EPSILON:number = 1e-6; // (0.000001) это "инженерный ноль", достаточный для компенсации погрешностей float
    
    /**
     * Степень B-сплайна, определяющая гладкость кривой.
     * degree = 1 - Линейный сплайн (ломаная линия, резкие углы). Резкие углы, подходит для технических траекторий
     * degree = 2 - Квадратичный сплайн (плавные кривые, непрерывная первая производная). Плавные повороты, хорош для движения транспорта
     * degree = 3 - Кубический сплайн (очень плавные кривые, непрерывная вторая производная). Максимально гладкие кривые, идеален для камеры или органического движения
     */
    @property
    public degree:number = 3;

    /**
     * Количество сегментов на каждый участок сплайна для аппроксимации кривой.
     * Определяет качество отрисовки и точность расчетов длины
     * Большее значение = более гладкая кривая, но выше нагрузка
     * Меньшее значение = угловатая кривая, но лучше производительность
     */
    @property
    public resolution:number = 50;

    /**
     * Устанавливает тип сплайна сомкнутый в конце или нет
     */
    @property
    public closed:boolean = false;

    /**
     * Блокирует поворот объекта по оси X
     */
    @property
    public blockXRotation:boolean = false;

    /**
     * Блокирует поворот объекта по оси Y
     */
    @property
    public blockYRotation:boolean = false;

    /**
     * Блокирует поворот объекта по оси Z
     */
    @property
    public blockZRotation:boolean = false;

    @property({type:AxisDirection})
    public forwardAxis:AxisDirection = AxisDirection.BACK_POSITIVE_Z;

    @property
    protected drawProjection:boolean = false; // Отрисовывать проекцию на XY плоскость

    @property({type:Graphics, visible: function(this:BSpline3D) { return this.drawProjection; }})
    protected graphics:Graphics = null;
    
    @property({visible: function(this:BSpline3D) { return this.drawProjection; }})
    protected lineWidth:number = 2;

    @property({visible: function(this:BSpline3D) { return this.drawProjection; }})
    protected lineColor:Color = color(255, 255, 255, 255);

    @property([Vec3])
    private controlPoints:Vec3[] = [];

    private knots:number[] = [];
    private totalLength:number = 0;
    private arcLengths:number[] = [];
    private parameterSamples:number[] = [];

    onLoad()
    {
        if (this.controlPoints.length > 0)
        {
            this.createSpline();
        }
    }

    /**
     * Создание сплайна с заданными параметрами
     * @param controlPoints массив контрольных точек, через которые проходит сплайн
     * @param closed если true, сплайн будет замкнутым (по умолчанию false)
     * @param degree степень сплайна (1-линейный, 2-квадратичный, 3-кубический)
     * @param resolution количество точек для аппроксимации кривой
     * @returns void
     */
    public create(controlPoints:Vec3[], closed:boolean = this.closed, degree:number = this.degree, resolution:number = this.resolution):void
    {
        if (controlPoints.length < degree + 1)
        {
            console.warn('Недостаточно точек для построения B-сплайна');
            return;
        }
        
        this.controlPoints = controlPoints.slice();
        this.closed = closed;
        this.degree = degree;
        this.resolution = resolution;
        
        this.createSpline();
    }

    /**
     * Установка состояния замкнутости сплайна
     * @param closed новое состояние замкнутости
     * @param redraw если true, автоматически перерисовать сплайн (по умолчанию true)
     */
    public setClosed(closed:boolean, redraw:boolean = true):void
    {
        if (this.closed !== closed && this.controlPoints.length > 0)
        {
            this.create(this.controlPoints, closed);

            if (redraw && this.drawProjection)
                this.drawBSplineProjection();
        }
    }

    /**
     * Получение точки на сплайне и её ориентации в параметре t
     * @param t параметр от 0 до 1, где 0 - начало сплайна, 1 - конец
     * @returns Возвращает объект BSplineData
     */
    public getPointAt(t:number):BSplineData
    {
        if (this.controlPoints.length === 0)
            return new BSplineData();

        let effectiveT:number = t;

        if (this.closed)
        {
            effectiveT = t % 1;

            if (effectiveT < 0)
                effectiveT += 1;
        }
        else
        {
            effectiveT = Math.max(0, Math.min(1, t));
            // Для незамкнутого сплайна при t=1 должна быть последняя точка, а не координата (0,0,0)
            if (effectiveT === 1)
            {
                // Возвращаем последнюю контрольную точку для конца незамкнутого сплайна
                const lastPoint = this.controlPoints[this.controlPoints.length - 1];
                const tangent = this.calculateBSplineDerivative(this.knots[this.knots.length - this.degree - 1]);
                const { normal, binormal } = this.calculateSimpleOrientation(tangent); // Используем упрощенный метод ориентации для избежания переворотов

                let rotation:Quat = this.quatFromBasis(tangent, normal);
                rotation = this.applyAxisCorrection(rotation);
                rotation = this.applyRotationConstraints(rotation); // Применяем блокировку осей поворота
                
                return new BSplineData(lastPoint.clone(), tangent.normalize(), rotation, normal.normalize(), binormal.normalize());
            }
        }

        const u:number = this.tToU(effectiveT);
        const position:Vec3 = this.calculateBSplinePoint(u);
        const tangent:Vec3 = this.calculateBSplineDerivative(u);
        
        const { normal, binormal } = this.calculateSimpleOrientation(tangent); // Используем упрощенный метод ориентации для избежания переворотов
        
        let rotation:Quat = this.quatFromBasis(tangent, normal);
        rotation = this.applyAxisCorrection(rotation);
        rotation = this.applyRotationConstraints(rotation); // Применяем блокировку осей поворота
        
        return new BSplineData(position, tangent.normalize(), rotation, normal.normalize(), binormal.normalize());
    }

    /**
     * Отрисовка проекции сплайна на XY плоскость с использованием Graphics
     * @returns void
     */
    public drawBSplineProjection():void
    {
        if (!this.graphics || this.controlPoints.length === 0)
            return;

        this.graphics.clear();
        this.graphics.lineWidth = this.lineWidth;
        this.graphics.strokeColor = this.lineColor;

        const points:Vec3[] = this.getUniformPoints(this.resolution);
        
        if (points.length > 0)
        {
            this.graphics.moveTo(points[0].x, points[0].y);

            for (let i = 1; i < points.length; i++)
            {
                this.graphics.lineTo(points[i].x, points[i].y);
            }
            
            if (this.closed)
                this.graphics.lineTo(points[0].x, points[0].y);
            
            this.graphics.stroke();
        }
    }

    /**
     * Получение равномерно распределенных точек вдоль сплайна
     * @param count количество точек для генерации
     * @returns массив точек Vec3
     */
    public getUniformPoints(count:number = this.resolution):Vec3[]
    {
        const points:Vec3[] = [];

        for (let i = 0; i < count; i++)
        {
            const t:number = i / (count - 1);
            const result = this.getPointAt(t);
            points.push(result.position);
        }

        return points;
    }

    /**
     * Расчет скорости движения в точке t (длина вектора касательной)
     * @param t параметр от 0 до 1
     * @returns числовое значение скорости
     */
    public getVelocityAt(t:number):number
    {
        if (this.controlPoints.length === 0) return 0;
        
        const effectiveT:number = this.closed ? t % 1 : Math.max(0, Math.min(1, t));
        const u:number = this.tToU(effectiveT);
        const tangent:Vec3 = this.calculateBSplineDerivative(u);

        return tangent.length();
    }

    /**
     * Очистка отрисованного сплайна
     */
    public clear():void
    {
        if (this.graphics)
            this.graphics.clear();
    }

    /**
     * Получение копии массива контрольных точек
     * @returns массив контрольных точек
     */
    public getControlPoints():Vec3[]
    {
        return this.controlPoints.slice();
    }

    /**
     * Получение общей длины сплайна
     * @returns длина сплайна в единицах движка
     */
    public getTotalLength():number
    {
        return this.totalLength;
    }

    /**
     * Вычисление длины сплайна в пикселях между параметрами t1 и t2
     * @param t1 начальный параметр на сплайне (0 до 1)
     * @param t2 конечный параметр на сплайне (0 до 1)
     * @returns длина участка сплайна в пикселях
     */
    public getArcLength(t1:number = 0, t2:number = 1):number
    {
        if (this.controlPoints.length === 0) return 0;
        
        // Нормализуем параметры
        t1 = Math.max(0, Math.min(1, t1));
        t2 = Math.max(0, Math.min(1, t2));
        
        if (t1 > t2)
            [t1, t2] = [t2, t1]; // Меняем местами если t1 > t2
        
        if (Math.abs(t1 - t2) < BSpline3D.GEOMETRY_EPSILON)
            return 0;
        
        // Вычисляем длину через численное интегрирование (метод трапеций)
        const segments:number = Math.ceil(this.resolution * (t2 - t1));
        let length:number = 0;
        let prevPoint:Vec3 = this.getPointAt(t1).position;
        
        for (let i = 1; i <= segments; i++)
        {
            const t:number = t1 + (i / segments) * (t2 - t1);
            const currentPoint:Vec3 = this.getPointAt(t).position;
            const distance:number = Vec3.distance(prevPoint, currentPoint);
            
            length += distance;
            prevPoint = currentPoint;
        }
        
        return length;
    }

    private createSpline():void
    {
        if (this.closed && this.controlPoints.length > this.degree)
            this.controlPoints = this.createClosedControlPoints(this.controlPoints);
        
        this.knots = this.createKnotVector(this.controlPoints.length);
        this.calculateArcLengths();
    }

    /**
     * Расчет стабильной системы координат без переворотов
     * @param tangent вектор касательной к сплайну
     * @returns объект с нормалью и бинормалью
     */
    private calculateSimpleOrientation(tangent:Vec3):{ normal:Vec3, binormal:Vec3 }
    {
        const normalizedTangent:Vec3 = tangent.normalize();
        
        // Всегда используем глобальный "верх" как нормаль
        const normal:Vec3 = Vec3.UP.clone();
        const binormal:Vec3 = v3();
        
        // Если движение почти вертикальное, используем альтернативный подход
        if (Math.abs(normalizedTangent.y) > 0.9)
        {
            // Для вертикального движения используем глобальный "вперед" как бинормаль
            binormal.set(Vec3.FORWARD);
        }
        else
        {
            // Для горизонтального движения вычисляем бинормаль нормально
            Vec3.cross(binormal, normalizedTangent, normal);
            binormal.normalize();
        }
        
        return { normal, binormal };
    }

    /**
     * Назначение: Создание дополнительных точек для замкнутого сплайна
     * @param points исходные контрольные точки
     * @returns расширенный массив точек для замкнутого сплайна
     */
    private createClosedControlPoints(points:Vec3[]):Vec3[]
    {
        const closedPoints:Vec3[] = points.slice();

        for (let i = 0; i < this.degree; i++)
        {
            closedPoints.push(points[i].clone());
        }

        return closedPoints;
    }

    /**
     * Создание узлового вектора для B-сплайна
     * @param n количество контрольных точек
     * @returns массив узловых значений
     */
    private createKnotVector(n:number):number[]
    {
        const knots:number[] = [];
        const totalKnots:number = n + this.degree + 1;
        
        if (this.closed)
        {
            for (let i = 0; i < totalKnots; i++)
            {
                knots.push(i);
            }
        }
        else
        {
            for (let i = 0; i < totalKnots; i++)
            {
                if (i <= this.degree)
                    knots.push(0);
                else if (i >= n)
                    knots.push(n - this.degree);
                else
                    knots.push(i - this.degree);
            }
        }
        
        return knots;
    }

    /**
     * Применение блокировки поворота вокруг осей
     * @param rotation исходный кватернион поворота
     * @returns скорректированный кватернион с учетом блокировок
     */
    private applyRotationConstraints(rotation:Quat):Quat
    {
        if (!this.blockXRotation && !this.blockYRotation && !this.blockZRotation)
            return rotation;

        const euler:Vec3 = v3();
        rotation.getEulerAngles(euler);

        if (this.blockXRotation) euler.x = 0;
        if (this.blockYRotation) euler.y = 0;
        if (this.blockZRotation) euler.z = 0;

        const constrainedRotation:Quat = new Quat();
        Quat.fromEuler(constrainedRotation, euler.x, euler.y, euler.z);
        
        return constrainedRotation;
    }

    /**
     * Предварительный расчет длин дуг для равномерной параметризации
     * @returns void
     */
    private calculateArcLengths():void
    {
        this.arcLengths = [];
        this.parameterSamples = [];
        this.totalLength = 0;

        if (this.knots.length < 2 * this.degree + 1)
            return;
        
        const uMin:number = this.knots[this.degree];
        const uMax:number = this.knots[this.knots.length - this.degree - 1];
        
        const sampleCount:number = this.resolution; 
        const samples: { u:number, point:Vec3 }[] = [];

        for (let i = 0; i <= sampleCount; i++)
        {
            const t:number = i / sampleCount;
            let u:number = uMin + t * (uMax - uMin);
            
            if (Math.abs(u - uMax) < BSpline3D.GEOMETRY_EPSILON)
                u = uMax - BSpline3D.GEOMETRY_EPSILON;

            const point:Vec3 = this.calculateBSplinePoint(u);
            samples.push({ u, point });
        }
        
        this.arcLengths.push(0);
        this.parameterSamples.push(samples[0].u);
        
        for (let i = 1; i < samples.length; i++)
        {
            const segmentLength:number = Vec3.distance(samples[i].point, samples[i - 1].point);
            this.totalLength += segmentLength;
            this.arcLengths.push(this.totalLength);
            this.parameterSamples.push(samples[i].u);
        }
    }

    /**
     * Преобразование равномерного параметра t в параметр сплайна u
     * @param t равномерный параметр от 0 до 1
     * @returns параметр u для расчетов B-сплайна
     */
    private tToU(t:number):number
    {
        if (this.totalLength === 0)
            return this.knots[this.degree];

        if (t <= 0)
            return this.parameterSamples[0];
        
        if (t >= 1)
            return this.parameterSamples[this.parameterSamples.length - 1];
        
        const targetLength:number = t * this.totalLength;
        
        let low:number = 0;
        let high:number = this.arcLengths.length - 1;
        let index:number = 0;
        
        // Бинарный поиск
        while (low <= high)
        {
            index = Math.floor((low + high) / 2);

            if (this.arcLengths[index] < targetLength)
                low = index + 1;
            else
                high = index - 1;
        }
        
        // Корректировка индекса для интерполяции
        if (this.arcLengths[index] < targetLength)
            index++;
        
        index = Math.max(1, Math.min(index, this.arcLengths.length - 1));
        
        const lengthBefore:number = this.arcLengths[index - 1];
        const lengthAfter:number = this.arcLengths[index];
        const segmentLength:number = lengthAfter - lengthBefore;
        
        if (segmentLength <= BSpline3D.GEOMETRY_EPSILON)
            return this.parameterSamples[index];
        
        const segmentT:number = (targetLength - lengthBefore) / segmentLength;
        const uBefore:number = this.parameterSamples[index - 1];
        const uAfter:number = this.parameterSamples[index];
        
        return uBefore + segmentT * (uAfter - uBefore);
    }


    /**
     * Создание кватерниона поворота из базисных векторов
     * @param tangent вектор направления "вперед"
     * @param normal вектор направления "вверх"
     * @returns кватернион поворота
     */
    private quatFromBasis(tangent:Vec3, normal:Vec3):Quat
    {
        return Quat.fromViewUp(quat(), tangent.normalize(), normal.normalize());
    }

    /**
     * Рекурсивный расчет базисной функции B-сплайна
     * @param i индекс базисной функции
     * @param k степень сплайна
     * @param u параметр сплайна
     * @returns значение базисной функции
     */
    private basisFunction(i:number, k:number, u:number):number
    {
        if (k === 0)
            return (u >= this.knots[i] && u < this.knots[i + 1]) ? 1 : 0;
        
        const denom1:number = this.knots[i + k] - this.knots[i];
        const denom2:number = this.knots[i + k + 1] - this.knots[i + 1];
        
        let term1:number = 0;
        let term2:number = 0;
        
        if (denom1 !== 0) term1 = ((u - this.knots[i]) / denom1) * this.basisFunction(i, k - 1, u);
        if (denom2 !== 0) term2 = ((this.knots[i + k + 1] - u) / denom2) * this.basisFunction(i + 1, k - 1, u);
        
        return term1 + term2;
    }

    /**
     * Расчет точки на B-сплайне для параметра u
     * @param u параметр сплайна
     * @returns координаты точки на сплайне
     */
    private calculateBSplinePoint(u:number):Vec3
    {
        const result:Vec3 = v3(0, 0, 0);

        for (let i = 0; i < this.controlPoints.length; i++)
        {
            const basis:number = this.basisFunction(i, this.degree, u);

            result.x += this.controlPoints[i].x * basis;
            result.y += this.controlPoints[i].y * basis;
            result.z += this.controlPoints[i].z * basis;
        }

        return result;
    }

    /**
     * Расчет первой производной (касательного вектора)
     * @param u параметр сплайна
     * @returns вектор касательной
     */
    private calculateBSplineDerivative(u:number):Vec3
    {
        const derivative:Vec3 = v3(0, 0, 0);

        for (let i = 0; i < this.controlPoints.length; i++)
        {
            const basisDerivative = this.basisFunctionDerivative(i, u);

            derivative.x += this.controlPoints[i].x * basisDerivative;
            derivative.y += this.controlPoints[i].y * basisDerivative;
            derivative.z += this.controlPoints[i].z * basisDerivative;
        }

        return derivative;
    }

    /**
     * Расчет производной базисной функции
     * @param i индекс базисной функции
     * @param u параметр сплайна
     * @returns значение производной базисной функции
     */
    private basisFunctionDerivative(i:number, u:number):number
    {
        if (this.degree === 0) return 0;

        const denom1:number = this.knots[i + this.degree] - this.knots[i];
        const denom2:number = this.knots[i + this.degree + 1] - this.knots[i + 1];

        // Добавлена проверка denom !== 0, иначе получался NaN
        const term1:number = denom1 !== 0 ? (this.degree / denom1) * this.basisFunction(i, this.degree - 1, u) : 0;
        const term2:number = denom2 !== 0 ? (this.degree / denom2) * this.basisFunction(i + 1, this.degree - 1, u) : 0;
        
        return term1 - term2;
    }

    /**
     * Вычисление доворота для поворота объекта вдоль его локальной оси.
     * @param rotation текущий поворот
     * @returns поворот вдоль локальной ось объекта
     */
    private applyAxisCorrection(rotation:Quat):Quat
    {
        const correction:Quat = new Quat();

        switch (this.forwardAxis)
        {
            case AxisDirection.FORWARD_NEGATIVE_Z:
                Quat.rotateY(correction, correction, Math.PI); // 180 градусов по Y
                break;
            case AxisDirection.BACK_POSITIVE_Z:
                return rotation; // Базовое поведение fromViewUp
            case AxisDirection.RIGHT_POSITIVE_X:
                Quat.rotateY(correction, correction, -Math.PI * 0.5); // -90 градусов по Y
                break;
            case AxisDirection.LEFT_NEGATIVE_X:
                Quat.rotateY(correction, correction, Math.PI * 0.5); // 90 градусов по Y
                break;
            case AxisDirection.UP_POSITIVE_Y:
                Quat.rotateX(correction, correction, Math.PI * 0.5); // 90 градусов по X
                break;
            case AxisDirection.DOWN_NEGATIVE_Y:
                Quat.rotateX(correction, correction, -Math.PI * 0.5); // -90 градусов по X
                break;
        }

        // Применяем локальный доворот к вычисленной ориентации
        return Quat.multiply(correction, rotation, correction);
    }
}