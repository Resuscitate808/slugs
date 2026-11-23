import { CustomAudioParam } from './CustomAudioParam';
import { IAudioParamOptions } from './IAudioParamOptions';

export class CustomAudioNode
{
    private readonly _gainNode: GainNode;
    private readonly _audioParams: Map<string, CustomAudioParam> = new Map();
    private _output?: AudioNode;
    private _targetCount = 0;
    private _onDestinationChange?: (targetCount: number) => void;

    constructor(
        input: AudioNode | null,
        output: AudioNode | null,
        params?: Record<string, IAudioParamOptions>,
        onDestinationChange?: (targetCount: number) => void
    )
    {
        const audioContext = (input || output).context;

        this._gainNode = audioContext.createGain();
        this._onDestinationChange = onDestinationChange;
        this._output = output ?? undefined;

        if (input)
        {
            this._gainNode.connect(input);
        }

        if (output)
        {
            this.overrideConnectMethods();
        }

        this.addAudioParams(audioContext, params);
    }

    public get node(): GainNode
    {
        return this._gainNode;
    }

    public getAudioParam(name: string): AudioParam
    {
        return this._audioParams.get(name).audioParam;
    }

    private overrideConnectMethods(): void
    {
        const owner = this;

        this._gainNode.connect = ((destination: AudioNode | AudioParam, output?: number, input?: number): AudioNode | void =>
        {
            owner._targetCount += 1;

            if (destination instanceof AudioNode)
            {
                owner._output.connect(destination, output, input);
                owner.notifyDestinationChange();
                return destination;
            }

            owner._output.connect(destination, output);
            owner.notifyDestinationChange();
        }) as GainNode['connect'];

        this._gainNode.disconnect = ((destination?: number | AudioNode | AudioParam, output?: number, input?: number): void =>
        {
            owner._targetCount = 0;

            if (destination === undefined)
            {
                owner._output.disconnect();
            }
            else if (typeof destination === 'number')
            {
                owner._output.disconnect(destination);
            }
            else if (destination instanceof AudioNode)
            {
                owner._output.disconnect(destination, output, input);
            }
            else
            {
                owner._output.disconnect(destination, output);
            }

            owner.notifyDestinationChange();
        }) as GainNode['disconnect'];
    }

    private notifyDestinationChange(): void
    {
        if (typeof this._onDestinationChange === 'function')
        {
            this._onDestinationChange(this._targetCount);
        }
    }

    private addAudioParams(audioContext: BaseAudioContext, params?: Record<string, IAudioParamOptions>): void
    {
        if (!params)
        {
            return;
        }

        const nodeWithParams = this._gainNode as GainNode & Record<string, AudioParam>;
        const keys = Object.keys(params);

        for (let i = 0; i < keys.length; i++)
        {
            const key = keys[i];
            const audioParam = new CustomAudioParam(audioContext, key, params[key]);

            this._audioParams.set(key, audioParam);
            nodeWithParams[key] = audioParam.audioParam;
        }
    }
}
