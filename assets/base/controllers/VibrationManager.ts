import { _decorator, Component, sys } from 'cc';

const { ccclass, property } = _decorator;

export enum VibrationPattern {
    Short = "short",
    Medium = "medium",
    Long = "long",
    Light = "light",
    Heavy = "heavy",
    Selection = "selection",
    Success = "success",
    Error = "error",
    Warning = "warning"
}

export interface VibrationConfig {
    duration?: number;        // Длительность в миллисекундах
    pattern?: number[];       // Паттерн вибрации [вибрировать, пауза, вибрировать, ...]
    repetitions?: number;     // Количество повторений
}

@ccclass('VibrationManager')
export class VibrationManager extends Component {
    @property({ tooltip: "Включить вибрацию" })
    public enableVibration: boolean = true;

    @property({ tooltip: "Длительность короткой вибрации (мс)" })
    public shortDuration: number = 50;

    @property({ tooltip: "Длительность средней вибрации (мс)" })
    public mediumDuration: number = 100;

    @property({ tooltip: "Длительность длинной вибрации (мс)" })
    public longDuration: number = 200;

    @property({ tooltip: "Длительность легкой вибрации (мс)" })
    public lightDuration: number = 30;

    @property({ tooltip: "Длительность сильной вибрации (мс)" })
    public heavyDuration: number = 150;

    @property({ tooltip: "Длительность вибрации выбора (мс)" })
    public selectionDuration: number = 20;

    private _isVibrating: boolean = false;
    private _vibrationTimeout: any = null;

    protected onDestroy(): void {
        this.stopVibration();
    }

    /**
     * Основной метод для вызова вибрации
     * @param config Конфигурация вибрации
     */
    public vibrate(config: VibrationConfig | VibrationPattern | number): void {
        if (!this.enableVibration) {
            return;
        }

        // Проверяем поддержку вибрации
        if (!this.isVibrationSupported()) {
            return;
        }

        // Парсим входные параметры
        let vibrationConfig: VibrationConfig = {};

        if (typeof config === 'number') {
            vibrationConfig.duration = config;
        } else if (typeof config === 'string') {
            vibrationConfig = this.getPatternFromEnum(config as VibrationPattern);
        } else {
            vibrationConfig = config;
        }

        this.vibrateMobile(vibrationConfig);
    }

    /**
     * Вибрация с предустановленным паттерном
     * @param pattern Паттерн вибрации
     */
    public vibrateWithPattern(pattern: VibrationPattern): void {
        this.vibrate(pattern);
    }

    /**
     * Короткая вибрация
     */
    public vibrateShort(): void {
        this.vibrate(VibrationPattern.Short);
    }

    /**
     * Средняя вибрация
     */
    public vibrateMedium(): void {
        this.vibrate(VibrationPattern.Medium);
    }

    /**
     * Длинная вибрация
     */
    public vibrateLong(): void {
        this.vibrate(VibrationPattern.Long);
    }

    /**
     * Легкая вибрация (для UI элементов)
     */
    public vibrateLight(): void {
        this.vibrate(VibrationPattern.Light);
    }

    /**
     * Сильная вибрация
     */
    public vibrateHeavy(): void {
        this.vibrate(VibrationPattern.Heavy);
    }

    /**
     * Вибрация при выборе
     */
    public vibrateSelection(): void {
        this.vibrate(VibrationPattern.Selection);
    }

    /**
     * Вибрация при успешном действии
     */
    public vibrateSuccess(): void {
        this.vibrate(VibrationPattern.Success);
    }

    /**
     * Вибрация при ошибке
     */
    public vibrateError(): void {
        this.vibrate(VibrationPattern.Error);
    }

    /**
     * Вибрация при предупреждении
     */
    public vibrateWarning(): void {
        this.vibrate(VibrationPattern.Warning);
    }

    /**
     * Остановить текущую вибрацию
     */
    public stopVibration(): void {
        if (this._vibrationTimeout) {
            clearTimeout(this._vibrationTimeout);
            this._vibrationTimeout = null;
        }

        if (this.isVibrationSupported()) {
            navigator.vibrate(0);
        }

        this._isVibrating = false;
    }

    /**
     * Проверка поддержки вибрации на устройстве
     */
    public isVibrationSupported(): boolean {
        return !!(navigator.vibrate || (window as any).navigator.webkitVibrate);
    }

    /**
     * Получение конфигурации из enum паттерна
     */
    private getPatternFromEnum(pattern: VibrationPattern): VibrationConfig {
        switch (pattern) {
            case VibrationPattern.Short:
                return { duration: this.shortDuration, repetitions: 1 };
            case VibrationPattern.Medium:
                return { duration: this.mediumDuration, repetitions: 1 };
            case VibrationPattern.Long:
                return { duration: this.longDuration, repetitions: 1 };
            case VibrationPattern.Light:
                return { duration: this.lightDuration, repetitions: 1 };
            case VibrationPattern.Heavy:
                return { duration: this.heavyDuration, repetitions: 1 };
            case VibrationPattern.Selection:
                return { duration: this.selectionDuration, repetitions: 1 };
            case VibrationPattern.Success:
                return { pattern: [50, 50, 50], repetitions: 1 };
            case VibrationPattern.Error:
                return { pattern: [200, 100, 200], repetitions: 1 };
            case VibrationPattern.Warning:
                return { pattern: [100, 50, 100, 50, 100], repetitions: 1 };
            default:
                return { duration: this.mediumDuration, repetitions: 1 };
        }
    }

    /**
     * Вибрация на мобильных устройствах
     */
    private vibrateMobile(config: VibrationConfig): void {
        const vibrateFunc = navigator.vibrate || (window as any).navigator.webkitVibrate;
        
        if (!vibrateFunc) {
            return;
        }

        // Останавливаем текущую вибрацию
        vibrateFunc.call(navigator, 0);

        // Формируем паттерн вибрации
        let vibrationPattern: number | number[] = 0;

        if (config.pattern && config.pattern.length > 0) {
            vibrationPattern = config.pattern;
            
            // Если есть повторения, создаем повторяющийся паттерн
            if (config.repetitions && config.repetitions > 1) {
                let repeatedPattern: number[] = [];
                for (let i = 0; i < config.repetitions; i++) {
                    repeatedPattern = repeatedPattern.concat(config.pattern);
                }
                vibrationPattern = repeatedPattern;
            }
        } else if (config.duration) {
            vibrationPattern = config.duration;
            
            // Если есть повторения, создаем массив с повторяющимися длительностями
            if (config.repetitions && config.repetitions > 1) {
                let repeatedPattern: number[] = [];
                for (let i = 0; i < config.repetitions; i++) {
                    repeatedPattern.push(config.duration);
                    if (i < config.repetitions - 1) {
                        repeatedPattern.push(50); // Пауза между повторениями
                    }
                }
                vibrationPattern = repeatedPattern;
            }
        }

        // Вызываем вибрацию
        if (vibrationPattern !== 0) {
            vibrateFunc.call(navigator, vibrationPattern);
            
            // Устанавливаем таймаут для сброса флага вибрации
            const totalDuration = this.getTotalDuration(vibrationPattern);
            if (totalDuration > 0) {
                this._isVibrating = true;
                if (this._vibrationTimeout) {
                    clearTimeout(this._vibrationTimeout);
                }
                this._vibrationTimeout = setTimeout(() => {
                    this._isVibrating = false;
                }, totalDuration);
            }
        }
    }

    /**
     * Получение общей длительности вибрации
     */
    private getTotalDuration(pattern: number | number[]): number {
        if (typeof pattern === 'number') {
            return pattern;
        }
        
        return pattern.reduce((sum, duration) => sum + duration, 0);
    }
}

// Экспортируем интерфейс для DI
export const IVibrationManager = Symbol("IVibrationManager");
export interface IVibrationManager {
    vibrate(config: VibrationConfig | VibrationPattern | number): void;
    vibrateShort(): void;
    vibrateMedium(): void;
    vibrateLong(): void;
    vibrateLight(): void;
    vibrateHeavy(): void;
    vibrateSelection(): void;
    vibrateSuccess(): void;
    vibrateError(): void;
    vibrateWarning(): void;
    stopVibration(): void;
    isVibrationSupported(): boolean;
}