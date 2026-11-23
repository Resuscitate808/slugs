interface JungleBuffers
{
    fadeBuffer: AudioBuffer;
    shiftDownBuffer: AudioBuffer;
    shiftUpBuffer: AudioBuffer;
}

export class Jungle
{
    private static readonly DELAY_TIME = 0.100;
    private static readonly FADE_TIME = 0.050;
    private static readonly BUFFER_TIME = 0.100;

    private static readonly bufferCache = new Map<BaseAudioContext, JungleBuffers>();

    public readonly input: GainNode;
    public readonly output: GainNode;

    private readonly mod1: AudioBufferSourceNode;
    private readonly mod2: AudioBufferSourceNode;
    private readonly mod3: AudioBufferSourceNode;
    private readonly mod4: AudioBufferSourceNode;
    private readonly fade1: AudioBufferSourceNode;
    private readonly fade2: AudioBufferSourceNode;

    private readonly mod1Gain: GainNode;
    private readonly mod2Gain: GainNode;
    private readonly mod3Gain: GainNode;
    private readonly mod4Gain: GainNode;
    private readonly modGain1: GainNode;
    private readonly modGain2: GainNode;

    private _disposed = false;

    constructor(context: BaseAudioContext)
    {
        const input = context.createGain();
        const output = context.createGain();
        this.input = input;
        this.output = output;

        const mod1 = context.createBufferSource();
        const mod2 = context.createBufferSource();
        const mod3 = context.createBufferSource();
        const mod4 = context.createBufferSource();
        this.mod1 = mod1;
        this.mod2 = mod2;
        this.mod3 = mod3;
        this.mod4 = mod4;

        const buffers = Jungle.getSharedBuffers(context);
        mod1.buffer = buffers.shiftDownBuffer;
        mod2.buffer = buffers.shiftDownBuffer;
        mod3.buffer = buffers.shiftUpBuffer;
        mod4.buffer = buffers.shiftUpBuffer;
        mod1.loop = true;
        mod2.loop = true;
        mod3.loop = true;
        mod4.loop = true;

        const mod1Gain = context.createGain();
        const mod2Gain = context.createGain();
        const mod3Gain = context.createGain();
        mod3Gain.gain.value = 0;
        const mod4Gain = context.createGain();
        mod4Gain.gain.value = 0;

        mod1.connect(mod1Gain);
        mod2.connect(mod2Gain);
        mod3.connect(mod3Gain);
        mod4.connect(mod4Gain);

        const modGain1 = context.createGain();
        const modGain2 = context.createGain();
        const delay1 = context.createDelay();
        const delay2 = context.createDelay();

        mod1Gain.connect(modGain1);
        mod2Gain.connect(modGain2);
        mod3Gain.connect(modGain1);
        mod4Gain.connect(modGain2);
        modGain1.connect(delay1.delayTime);
        modGain2.connect(delay2.delayTime);

        const fade1 = context.createBufferSource();
        const fade2 = context.createBufferSource();
        this.fade1 = fade1;
        this.fade2 = fade2;
        fade1.buffer = buffers.fadeBuffer;
        fade2.buffer = buffers.fadeBuffer;
        fade1.loop = true;
        fade2.loop = true;

        const mix1 = context.createGain();
        const mix2 = context.createGain();
        mix1.gain.value = 0;
        mix2.gain.value = 0;

        fade1.connect(mix1.gain);
        fade2.connect(mix2.gain);

        input.connect(delay1);
        input.connect(delay2);
        delay1.connect(mix1);
        delay2.connect(mix2);
        mix1.connect(output);
        mix2.connect(output);

        const t = context.currentTime + 0.050;
        const t2 = t + Jungle.BUFFER_TIME - Jungle.FADE_TIME;
        mod1.start(t);
        mod2.start(t2);
        mod3.start(t);
        mod4.start(t2);
        fade1.start(t);
        fade2.start(t2);

        this.mod1Gain = mod1Gain;
        this.mod2Gain = mod2Gain;
        this.mod3Gain = mod3Gain;
        this.mod4Gain = mod4Gain;
        this.modGain1 = modGain1;
        this.modGain2 = modGain2;

        this.setDelay(Jungle.DELAY_TIME);
    }

    public dispose(): void
    {
        if (this._disposed)
            return;

        this._disposed = true;
        Jungle.stopBufferSource(this.mod1);
        Jungle.stopBufferSource(this.mod2);
        Jungle.stopBufferSource(this.mod3);
        Jungle.stopBufferSource(this.mod4);
        Jungle.stopBufferSource(this.fade1);
        Jungle.stopBufferSource(this.fade2);
    }

    public setDelay(delayTime: number): void
    {
        this.modGain1.gain.setTargetAtTime(0.5 * delayTime, 0, 0.010);
        this.modGain2.gain.setTargetAtTime(0.5 * delayTime, 0, 0.010);
    }

    public setPitchOffset(mult: number): void
    {
        if (mult > 0)
        {
            this.mod1Gain.gain.value = 0;
            this.mod2Gain.gain.value = 0;
            this.mod3Gain.gain.value = 1;
            this.mod4Gain.gain.value = 1;
        }
        else
        {
            this.mod1Gain.gain.value = 1;
            this.mod2Gain.gain.value = 1;
            this.mod3Gain.gain.value = 0;
            this.mod4Gain.gain.value = 0;
        }

        this.setDelay(Jungle.DELAY_TIME * Math.abs(mult));
    }

    private static getSharedBuffers(context: BaseAudioContext): JungleBuffers
    {
        let buffers = Jungle.bufferCache.get(context);

        if (!buffers)
        {
            buffers = {
                fadeBuffer: Jungle.createFadeBuffer(context, Jungle.BUFFER_TIME, Jungle.FADE_TIME),
                shiftDownBuffer: Jungle.createDelayTimeBuffer(context, Jungle.BUFFER_TIME, Jungle.FADE_TIME, false),
                shiftUpBuffer: Jungle.createDelayTimeBuffer(context, Jungle.BUFFER_TIME, Jungle.FADE_TIME, true),
            };
            Jungle.bufferCache.set(context, buffers);
        }

        return buffers;
    }

    private static stopBufferSource(source: AudioBufferSourceNode): void
    {
        try
        {
            source.stop();
        }
        catch
        {
            // Already stopped or never started.
        }
    }

    private static createFadeBuffer(context: BaseAudioContext, activeTime: number, fadeTime: number): AudioBuffer
    {
        const length1 = activeTime * context.sampleRate;
        const length2 = (activeTime - 2 * fadeTime) * context.sampleRate;
        const length = length1 + length2;
        const buffer = context.createBuffer(1, length, context.sampleRate);
        const p = buffer.getChannelData(0);
        const fadeLength = fadeTime * context.sampleRate;
        const fadeIndex1 = fadeLength;
        const fadeIndex2 = length1 - fadeLength;

        for (let i = 0; i < length1; ++i)
        {
            let value: number;

            if (i < fadeIndex1)
            {
                value = Math.sqrt(i / fadeLength);
            }
            else if (i >= fadeIndex2)
            {
                value = Math.sqrt(1 - (i - fadeIndex2) / fadeLength);
            }
            else
            {
                value = 1;
            }

            p[i] = value;
        }

        for (let i = length1; i < length; ++i)
        {
            p[i] = 0;
        }

        return buffer;
    }

    private static createDelayTimeBuffer(context: BaseAudioContext, activeTime: number, fadeTime: number, shiftUp: boolean): AudioBuffer
    {
        const length1 = activeTime * context.sampleRate;
        const length2 = (activeTime - 2 * fadeTime) * context.sampleRate;
        const length = length1 + length2;
        const buffer = context.createBuffer(1, length, context.sampleRate);
        const p = buffer.getChannelData(0);

        for (let i = 0; i < length1; ++i)
        {
            if (shiftUp)
            {
                p[i] = (length1 - i) / length;
            }
            else
            {
                p[i] = i / length1;
            }
        }

        for (let i = length1; i < length; ++i)
        {
            p[i] = 0;
        }

        return buffer;
    }
}
