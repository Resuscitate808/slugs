import { IAudioParamOptions } from './IAudioParamOptions';

export class CustomAudioParam
{
    public readonly min?: number;
    public readonly max?: number;
    public readonly defaultValue?: number;
    public readonly name: string;
    public readonly context: BaseAudioContext;

    private readonly _targets: AudioParam[];
    private _lastValue: number;
    private readonly _audioParam: AudioParam;

    constructor(audioContext: BaseAudioContext, name: string, options: IAudioParamOptions = {})
    {
        this.context = audioContext;
        this.name = name;
        this.min = options.min;
        this.max = options.max;
        this.defaultValue = options.defaultValue;

        if (options.targets)
        {
            this._targets = options.targets;
        }
        else if (options.target)
        {
            this._targets = [options.target];
        }
        else
        {
            this._targets = [];
        }

        this._lastValue = options.defaultValue;
        this._audioParam = this.createAudioParam();

        if (options.defaultValue != null)
        {
            this.value = options.defaultValue;
        }
    }

    public get audioParam(): AudioParam
    {
        return this._audioParam;
    }

    public get value(): number
    {
        return this._lastValue;
    }

    public set value(value: number)
    {
        value = this.fence(value);
        this._lastValue = value;

        for (let i = 0; i < this._targets.length; i++)
        {
            this._targets[i].value = value;
        }
    }

    public addTarget(target: AudioParam): void
    {
        this._targets.push(target);

        if (this._lastValue != null)
        {
            target.value = this._lastValue;
        }
    }

    public clearTargets(): void
    {
        this._targets.length = 0;
    }

    private fence(value: number): number
    {
        if (this.min != null)
        {
            value = Math.max(this.min, value);
        }

        if (this.max != null)
        {
            value = Math.min(this.max, value);
        }

        return value;
    }

    private applySetValueAtTime(value: number, startTime: number): void
    {
        value = this.fence(value);
        this._lastValue = value;

        for (let i = 0; i < this._targets.length; i++)
        {
            this._targets[i].setValueAtTime(value, startTime);
        }
    }

    private applySetTargetAtTime(value: number, startTime: number, timeConstant: number): void
    {
        value = this.fence(value);

        for (let i = 0; i < this._targets.length; i++)
        {
            const target = this._targets[i];

            if (target.setTargetAtTime)
            {
                target.setTargetAtTime(value, startTime, timeConstant);
            }
        }
    }

    private applyLinearRampToValueAtTime(value: number, endTime: number): void
    {
        value = this.fence(value);
        this._lastValue = value;

        for (let i = 0; i < this._targets.length; i++)
        {
            this._targets[i].linearRampToValueAtTime(value, endTime);
        }
    }

    private applyExponentialRampToValueAtTime(value: number, endTime: number): void
    {
        value = this.fence(value);
        this._lastValue = value;

        for (let i = 0; i < this._targets.length; i++)
        {
            this._targets[i].exponentialRampToValueAtTime(value, endTime);
        }
    }

    private applySetValueCurveAtTime(curve: Float32Array | number[], startTime: number, duration: number): void
    {
        this._lastValue = curve[curve.length - 1];

        for (let i = 0; i < this._targets.length; i++)
        {
            this._targets[i].setValueCurveAtTime(curve, startTime, duration);
        }
    }

    private applyCancelScheduledValues(startTime: number): void
    {
        for (let i = 0; i < this._targets.length; i++)
        {
            this._targets[i].cancelScheduledValues(startTime);
        }
    }

    private createAudioParam(): AudioParam
    {
        const param = Object.create(AudioParam.prototype) as AudioParam;
        const owner = this;

        Object.defineProperties(param, {
            value: {
                get: (): number => owner.value,
                set: (value: number): void => { owner.value = value; },
                enumerable: true
            },
            defaultValue: {
                get: (): number => owner.defaultValue,
                enumerable: true
            },
            name: {
                value: owner.name,
                writable: false,
                enumerable: true
            },
            min: {
                value: owner.min,
                writable: false,
                enumerable: true
            },
            max: {
                value: owner.max,
                writable: false,
                enumerable: true
            },
            context: {
                value: owner.context,
                writable: false,
                enumerable: true
            }
        });

        param.setValueAtTime = (value: number, startTime: number): AudioParam =>
        {
            owner.applySetValueAtTime(value, startTime);
            return param;
        };

        param.setTargetAtTime = (value: number, startTime: number, timeConstant: number): AudioParam =>
        {
            owner.applySetTargetAtTime(value, startTime, timeConstant);
            return param;
        };

        param.linearRampToValueAtTime = (value: number, endTime: number): AudioParam =>
        {
            owner.applyLinearRampToValueAtTime(value, endTime);
            return param;
        };

        param.exponentialRampToValueAtTime = (value: number, endTime: number): AudioParam =>
        {
            owner.applyExponentialRampToValueAtTime(value, endTime);
            return param;
        };

        param.setValueCurveAtTime = (curve: Float32Array | number[], startTime: number, duration: number): AudioParam =>
        {
            owner.applySetValueCurveAtTime(curve, startTime, duration);
            return param;
        };

        param.cancelScheduledValues = (startTime: number): AudioParam =>
        {
            owner.applyCancelScheduledValues(startTime);
            return param;
        };

        return param;
    }
}
