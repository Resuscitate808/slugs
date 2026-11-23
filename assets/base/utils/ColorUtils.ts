import { Color, IColorLike } from "cc";

export class ColorUtils
{
    /**
     * Осветляет
     * @param out ссылка куда будет присвоен результат вычисления
     * @param color изменяемый цвет
     * @param percent процент от 0 - исходный цвет до 1 - максимально светлый
     * @returns out
     */
    static lighten<Out extends Color>(out:Out, color:Color, percent:number):Out
    {
        const r = color.r;
        const g = color.g;
        const b = color.b;
        
        const newR = Math.min(255, r + (255 - r) * (percent));
        const newG = Math.min(255, g + (255 - g) * (percent));
        const newB = Math.min(255, b + (255 - b) * (percent));

        out.r = newR;
        out.g = newG;
        out.b = newB;
        out.a = color.a;
        
        return out;
    }

    /**
     * Затемняет
     * @param out ссылка куда будет присвоен результат вычисления
     * @param color изменяемый цвет
     * @param percent процент от 0 - исходный цвет до 1 - максимально тёмный
     * @returns out
     */
    static darken<Out extends Color>(out:Out, color:Color, percent:number):Out
    {
        const r = color.r;
        const g = color.g;
        const b = color.b;
        
        const newR = Math.max(0, r - r * (percent));
        const newG = Math.max(0, g - g * (percent));
        const newB = Math.max(0, b - b * (percent));
        
        out.r = newR;
        out.g = newG;
        out.b = newB;
        out.a = color.a;
        
        return out;
    }

    /**
     * Усиливает яркость
     * @param out ссылка куда будет присвоен результат вычисления
     * @param color изменяемый цвет
     * @param percent процент от 0 - исходный цвет до 1 - максимально светлый
     * @returns out
     */
    static intensify<Out extends Color>(out:Out, color:Color, percent:number):Out
    {
        const r = color.r;
        const g = color.g;
        const b = color.b;
        
        const max = Math.max(r, g, b);
        
        if (max === 0)
        {
            const value = Math.min(255, 255 * percent);

            out.r = value;
            out.g = value;
            out.b = value;
            out.a = color.a;
            
            return out;
        }
        
        const scale = 1 + percent * ((255 / max) - 1);
        const newR = Math.min(255, Math.round(r * scale));
        const newG = Math.min(255, Math.round(g * scale));
        const newB = Math.min(255, Math.round(b * scale));
        
        out.r = newR;
        out.g = newG;
        out.b = newB;
        out.a = color.a;
        
        return out;
    }

    /**
     * Повышает насыщенность
     * @param out ссылка куда будет присвоен результат вычисления
     * @param color изменяемый цвет
     * @param percent изменения
     * @returns out
     */
    static saturate<Out extends Color>(out:Out, color:Color, percent:number):Out
    {
        const r = color.r / 255;
        const g = color.g / 255;
        const b = color.b / 255;
        
        const gray = (r + g + b) / 3;
        
        const newR = Math.min(1, Math.max(0, gray + (r - gray) * (1 + percent)));
        const newG = Math.min(1, Math.max(0, gray + (g - gray) * (1 + percent)));
        const newB = Math.min(1, Math.max(0, gray + (b - gray) * (1 + percent)));
        
        out.r = Math.round(newR * 255);
        out.g = Math.round(newG * 255);
        out.b = Math.round(newB * 255);
        out.a = color.a;
        
        return out;
    }

    /**
     * Понижает насыщенность
     * @param out ссылка куда будет присвоен результат вычисления
     * @param color изменяемый цвет
     * @param percent процент
     * @returns out
     */
    static desaturate<Out extends Color>(out:Out, color:Color, percent:number):Out
    {
        const r = color.r / 255;
        const g = color.g / 255;
        const b = color.b / 255;
        
        const gray = (r + g + b) / 3;
        
        const newR = Math.min(1, Math.max(0, gray + (r - gray) * (1 - percent)));
        const newG = Math.min(1, Math.max(0, gray + (g - gray) * (1 - percent)));
        const newB = Math.min(1, Math.max(0, gray + (b - gray) * (1 - percent)));
        
        out.r = Math.round(newR * 255);
        out.g = Math.round(newG * 255);
        out.b = Math.round(newB * 255);
        out.a = color.a;
        
        return out;
    }

    /**
     * Яркость + насыщенность
     * @param out ссылка куда будет присвоен результат вычисления
     * @param color изменяемый цвет
     * @param intensifyPercent процент яркости
     * @param saturatePercent процент насыщенности
     * @returns out
     */
    static enhance<Out extends Color>(out:Out, color:Color, intensifyPercent:number, saturatePercent:number):Out
    {
        let enhanced = this.intensify(new Color(), color, intensifyPercent);
        this.saturate(out, enhanced, saturatePercent);

        return out;
    }
}