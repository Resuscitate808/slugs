import { CustomAudioNode } from './CustomAudioNode';
import { IAudioParamOptions } from './IAudioParamOptions';
import { Jungle } from './Jungle';

export class PitchShift
{
    public readonly dry: AudioParam;
    public readonly wet: AudioParam;

    private readonly _audioNode: GainNode;
    private readonly _jungle: Jungle;
    private _transpose = 0;

    constructor(audioContext: BaseAudioContext)
    {
        this._jungle = new Jungle(audioContext);

        const input = audioContext.createGain();
        const wet = audioContext.createGain();
        const dry = audioContext.createGain();
        const output = audioContext.createGain();

        dry.gain.value = 0;

        input.connect(wet);
        input.connect(dry);
        wet.connect(this._jungle.input);
        this._jungle.output.connect(output);
        dry.connect(output);

        const params: Record<string, IAudioParamOptions> = {
            dry: {
                min: 0,
                defaultValue: 0,
                target: dry.gain
            },
            wet: {
                min: 0,
                defaultValue: 1,
                target: wet.gain
            }
        };

        const customAudioNode = new CustomAudioNode(input, output, params);
        this._audioNode = customAudioNode.node;
        this.dry = customAudioNode.getAudioParam('dry');
        this.wet = customAudioNode.getAudioParam('wet');

        this._jungle.setPitchOffset(PitchShift.getPitchMultiplier(12));
    }

    public get node(): GainNode
    {
        return this._audioNode;
    }

    public get transpose(): number
    {
        return this._transpose;
    }

    public set transpose(value: number)
    {
        this._transpose = PitchShift.getPitchMultiplier(value);
        this._jungle.setPitchOffset(this._transpose);
    }

    public connect(destination: AudioNode, output?: number, input?: number): AudioNode;
    public connect(destinationParam: AudioParam, output?: number): void;
    public connect(destination: AudioNode | AudioParam, output?: number, input?: number): AudioNode | void
    {
        if (destination instanceof AudioNode)
        {
            return this._audioNode.connect(destination, output, input);
        }

        this._audioNode.connect(destination, output);
    }

    public disconnect(): void;
    public disconnect(output: number): void;
    public disconnect(destinationNode: AudioNode): void;
    public disconnect(destinationNode: AudioNode, output: number): void;
    public disconnect(destinationNode: AudioNode, output: number, input: number): void;
    public disconnect(destinationParam: AudioParam): void;
    public disconnect(destinationParam: AudioParam, output: number): void;
    public disconnect(destination?: number | AudioNode | AudioParam, output?: number, input?: number): void
    {
        if (destination === undefined)
        {
            this._audioNode.disconnect();
            return;
        }

        if (typeof destination === 'number')
        {
            this._audioNode.disconnect(destination);
            return;
        }

        if (destination instanceof AudioNode)
        {
            this._audioNode.disconnect(destination, output, input);
            return;
        }

        this._audioNode.disconnect(destination, output);
    }

    public dispose(): void
    {
        this._jungle.dispose();
        this.disconnect();
    }

    private static getPitchMultiplier(x: number): number
    {
        if (x < 0)
        {
            return x / 12;
        }

        const a5 = 1.8149080040913423e-7;
        const a4 = -0.000019413043101157434;
        const a3 = 0.0009795096626987743;
        const a2 = -0.014147877819596033;
        const a1 = 0.23005591195033048;
        const a0 = 0.02278153473118749;

        const x2 = x * x;
        const x3 = x2 * x;
        const x4 = x3 * x;
        const x5 = x4 * x;

        return a0 + x * a1 + x2 * a2 + x3 * a3 + x4 * a4 + x5 * a5;
    }
}
