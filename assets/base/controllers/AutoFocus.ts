import { _decorator, Component, director, Node } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Компонент автоматически устнавливает фокус на канвас игры
 * без необходимости тыкать в игру мышкой
 */
@ccclass('AutoFocus')
export class AutoFocus extends Component
{
    onLoad()
    {
        // Сохраняем узел между сценами
        director.addPersistRootNode(this.node);

        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;

        if (canvas)
        {
            // Устанавливаем фокус на canvas
            canvas.focus();
            
            // Обработчик для повторного фокуса при потере
            canvas.addEventListener('blur', () => {
                canvas.focus();
            });
        }
    }
}