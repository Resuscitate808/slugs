import { _decorator, AudioClip, AudioSource, Component, director, Enum, sys } from 'cc';
import { PitchShift } from '../utils/audio_pitch_shift/PitchShift';
import { Inject, ServiceLocator } from './ServiceLocator';
import { IEventBus } from './EventBus';
import { IAudioController, SoundType } from './IAudioController';
import { AdsEvents } from '../integrations/IAdsAdapter';
const { ccclass, property } = _decorator;


@ccclass("SoundInfo")
class SoundInfo {
    @property({ type: AudioClip })
    public audioClip: AudioClip = null;

    @property
    public volumeMultiplier: number = 1;

    constructor(audioClip: AudioClip) {
        this.audioClip = audioClip;
    }
}

@ccclass("AudioSourceData")
class AudioSourceData {
    public audioSource: AudioSource;
    public volumeMultiplier: number = 1;
    public assignedVolume: number = 1;

    constructor(audioSource: AudioSource, volumeMultiplier: number, assignedVolume: number) {
        this.audioSource = audioSource;
        this.volumeMultiplier = volumeMultiplier;
        this.assignedVolume = assignedVolume;
    }
}



@ccclass('AudioController')
export class AudioController extends Component implements IAudioController {
    @property({ type: [SoundInfo] })
    private musicAudioInfos: SoundInfo[] = [];

    @property({ type: [SoundInfo] })
    private effectAudioInfos: SoundInfo[] = [];

    @property({ type: [SoundInfo] })
    private loopsAudioInfos: SoundInfo[] = [];

    @property
    private maxPlayedEffectsCount: number = 5;

    @property
    private musicVolumeMultiplicator: number = 1;

    @property
    private effectVolumeMultiplicator: number = 1;

    private _effectNameMap: Map<string, SoundInfo> = new Map<string, SoundInfo>();

    @Inject(IEventBus)
    private _eventBus: IEventBus

    private _musicSources: Map<string, AudioSourceData> = new Map<string, AudioSourceData>();
    private _effectSource: AudioSource;

    private _loopsSources: Map<string, AudioSourceData> = new Map<string, AudioSourceData>();

    protected volumesByTypes: Map<SoundType, number> = new Map([
        [SoundType.None, 0.0],
        [SoundType.Master, 1.0],
        [SoundType.Music, 0.5],
        [SoundType.Effects, 1]
    ]);

    private _playedEffectsCount: number = 0;
    private _audioContext: AudioContext | null = null;
    private _pitchShiftPool: PitchShift[] = [];
    private _pitchShiftPoolInitialized = false;

    onLoad() {
        ServiceLocator.instance.register(IAudioController, this);
        director.addPersistRootNode(this.node);

        for (let i = 0; i < this.effectAudioInfos.length; i++) {
            const info = this.effectAudioInfos[i];

            this._effectNameMap.set(info.audioClip.name, info);
        }

        this._effectSource = this.node.addComponent(AudioSource);

        this._eventBus.eventTarget.on(AdsEvents.FullscreenAdOpened, this.onInterOpened, this);
        this._eventBus.eventTarget.on(AdsEvents.FullscreenAdClosed, this.onInterClosed, this);
        this._eventBus.eventTarget.on(AdsEvents.RewardedAdOpened, this.onRewardedOpened, this);
        this._eventBus.eventTarget.on(AdsEvents.RewardedAdClosed, this.onRewardedClosed, this);
    }

    onDestroy(): void {
        for (let i = 0; i < this._pitchShiftPool.length; i++) {
            this._pitchShiftPool[i].dispose();
        }

        this._pitchShiftPool.length = 0;
        this._pitchShiftPoolInitialized = false;

        this._eventBus.eventTarget.off(AdsEvents.FullscreenAdOpened, this.onInterOpened, this);
        this._eventBus.eventTarget.off(AdsEvents.FullscreenAdClosed, this.onInterClosed, this);
        this._eventBus.eventTarget.off(AdsEvents.RewardedAdOpened, this.onRewardedOpened, this);
        this._eventBus.eventTarget.off(AdsEvents.RewardedAdClosed, this.onRewardedClosed, this);
    }

    initilize() {
        this.actualizeVolumeFromSave();
    }

    getSoundVolume(soundType: SoundType): number {
        if (this.volumesByTypes.has(soundType)) {
            return this.volumesByTypes.get(soundType)
        }

        console.warn("нет такого типа " + soundType);
        return 0;
    }

    setSoundVolume(soundType: SoundType, value: number) {
        this.setVolume(soundType, value);
        this.saveVolumeToSave();
    }

    public playEffect(effectName: string, volume: number = 1): void {
        if (this._effectNameMap.has(effectName)) {
            const info = this._effectNameMap.get(effectName);
            this.playEffectClip(info.audioClip, volume * info.volumeMultiplier);
        }
    }

    public playEffectClip(clip: AudioClip, volume: number = 1): void {
        if (!clip) return;
        if (this.isSoundMuted(SoundType.Master) || this.isSoundMuted(SoundType.Effects))
            return;

        if (this._playedEffectsCount >= this.maxPlayedEffectsCount) {
            return;
        }

        if (!this._effectSource) this._effectSource = this.node.addComponent(AudioSource);
        this._playedEffectsCount++;
        this._effectSource.playOneShot(clip, volume * this.volumesByTypes.get(SoundType.Master) * this.volumesByTypes.get(SoundType.Effects) * this.effectVolumeMultiplicator);
        setTimeout(() => {
            this._playedEffectsCount--;
        }, Math.max(50, clip.getDuration() * 1000));
    }

    public playLoop(loopName: string, volume: number = 1): void {
        if (this.isSoundMuted(SoundType.Master) || this.isSoundMuted(SoundType.Effects))
            return;

        for (let i = 0; i < this.loopsAudioInfos.length; i++) {
            const info: SoundInfo = this.loopsAudioInfos[i];

            if (info.audioClip.name == loopName) {
                let currentLoopSource: AudioSource;

                if (this._loopsSources.has(loopName)) {
                    currentLoopSource = this._loopsSources.get(loopName).audioSource;
                } else {
                    currentLoopSource = null;
                }

                if (currentLoopSource == null) {
                    currentLoopSource = new AudioSource();
                    let loopSourceData = new AudioSourceData(currentLoopSource, info.volumeMultiplier, volume);
                    this._loopsSources.set(loopName, loopSourceData);
                }

                currentLoopSource.clip = info.audioClip;
                currentLoopSource.loop = true;
                currentLoopSource.volume = volume * info.volumeMultiplier * this.volumesByTypes.get(SoundType.Master) * this.volumesByTypes.get(SoundType.Effects) * this.effectVolumeMultiplicator;
                currentLoopSource.play();
                break;
            }
        }
    }

    public stopLoop(loopName: string): void {
        if (this._loopsSources.has(loopName)) {
            const loopSourceData: AudioSourceData = this._loopsSources.get(loopName);
            loopSourceData.audioSource.stop();
            this._loopsSources.delete(loopName);
        }
    }

    public stopAllLoops(): void {
        this._loopsSources.forEach((loopSourceData: AudioSourceData, loopName: string) => {
            loopSourceData.audioSource.stop();
        });
        this._loopsSources.clear();
    }

    public playEffectWithPitchShift(effectName: string, pitchShift: number, volume: number = 1): void {
        if (this.isSoundMuted(SoundType.Master) || this.isSoundMuted(SoundType.Effects))
            return;

        if (this._playedEffectsCount >= this.maxPlayedEffectsCount)
            return;

        if (!this._effectNameMap.has(effectName))
            return;

        if (pitchShift > 12) {
            pitchShift = 12;
        }
        if (pitchShift < 0) {
            pitchShift = 0;
        }

        if (!this.isPitchShiftSupported() || pitchShift == 0) {
            this.playEffect(effectName, volume);
            return;
        }

        const info = this._effectNameMap.get(effectName);
        const audioContext = this.getAudioContext();
        const audioUrl = info.audioClip.nativeUrl;

        if (!audioContext || !audioUrl) {
            this.playEffect(effectName, volume);
            return;
        }

        const pitchShifter = this.acquirePitchShifter(audioContext);

        if (!pitchShifter)
            return;

        this._playedEffectsCount++;

        const effectVolume = volume * info.volumeMultiplier * this.volumesByTypes.get(SoundType.Master) * this.volumesByTypes.get(SoundType.Effects) * this.effectVolumeMultiplicator;
        pitchShifter.transpose = pitchShift;

        // Управление балансом
        pitchShifter.wet.value = pitchShift / 12;  // уровень обработанного сигнала 100% обработанного сигнала
        pitchShifter.dry.value = 1 - pitchShift / 12;  // уровень сухого сигнала (0 - только обработанный) 0% сухого сигнала

        const cleanupPitchShift = () => {
            pitchShifter.dispose();
            this.releasePitchShifter(audioContext);
            this._playedEffectsCount--;
        };

        if (audioContext.state === 'suspended') {
            void audioContext.resume();
        }

        this.playPitchShiftedMediaElement(audioContext, audioUrl, effectVolume, pitchShifter, cleanupPitchShift, () => {
            this.playEffect(effectName, volume);
        });
    }

    public playMusic(musicName: string, loop: boolean = false, volume: number = 1): void {
        for (let i = 0; i < this.musicAudioInfos.length; i++) {
            const info = this.musicAudioInfos[i];
            if (info.audioClip?.name == musicName) {
                this.playMusicClip(info.audioClip, loop, volume * info.volumeMultiplier, musicName);
                break;
            }
        }
    }

    public playMusicClip(clip: AudioClip, loop: boolean = false, volume: number = 1, key?: string): void {
        if (!clip) return;
        const musicName = key || clip.name;
        let musicSourceData: AudioSourceData = this.getMusicSource(musicName);
        if (musicSourceData && musicSourceData.audioSource.playing && musicSourceData.audioSource.clip === clip) {
            musicSourceData.assignedVolume = volume;
            this.applyVolumeToMusicSource();
            return;
        }

        let musicSource: AudioSource;
        if (musicSourceData) {
            musicSource = musicSourceData.audioSource;
            musicSource.stop();
        } else {
            musicSource = this.node.addComponent(AudioSource);
        }

        musicSource.clip = clip;
        musicSource.loop = loop;
        musicSource.volume = volume * this.volumesByTypes.get(SoundType.Master) * this.volumesByTypes.get(SoundType.Music) * this.musicVolumeMultiplicator;
        musicSource.play();
        this._musicSources.set(musicName, new AudioSourceData(musicSource, 1, volume));
    }

    public stopMusic(musicName: string): void {
        let musicSourceData: AudioSourceData = this.getMusicSource(musicName);

        if (musicSourceData && musicSourceData.audioSource.playing) {
            musicSourceData.audioSource.stop();
            this._musicSources.delete(musicName);
        }
    }

    public stopAllMusic(): void {
        for (let [key, musicSourceData] of this._musicSources) {
            musicSourceData.audioSource.stop();
        }

        this._musicSources.clear();
    }

    public isMusicPlaying(musicName: string): boolean {
        for (let [key, musicSourceData] of this._musicSources) {
            if (key == musicName)
                return musicSourceData.audioSource.playing;
        }
        return false;
    }

    private setVolume(soundType: SoundType, value: number) {
        if (this.volumesByTypes.has(soundType)) {
            this.volumesByTypes.set(soundType, value);
        }
        else {
            console.warn("нет такого типа " + soundType);
        }

        if (soundType == SoundType.Music || soundType == SoundType.Master) {
            this.applyVolumeToMusicSource();
        }

        if (soundType == SoundType.Effects || soundType == SoundType.Master) {
            this.applyVolumeToLoopSource();
        }
    }

    protected saveVolumeToSave() {

    }

    protected actualizeVolumeFromSave() {

    }

    private isSoundMuted(soundType: SoundType): boolean {
        return this.volumesByTypes.get(soundType) <= 0.0001;
    }

    private onInterOpened() {
        if (this.isSoundMuted(SoundType.Master))
            return;

        this.setVolume(SoundType.Master, 0);
    }

    private onInterClosed() {
        this.actualizeVolumeFromSave();
        this.applyVolumeToMusicSource();
    }

    private onRewardedOpened(placement: string) {
        if (this.isSoundMuted(SoundType.Master))
            return;

        this.setVolume(SoundType.Master, 0);
    }

    private onRewardedClosed(placement: string) {
        this.actualizeVolumeFromSave();
        this.applyVolumeToMusicSource();
    }

    private playPitchShiftedMediaElement(
        audioContext: AudioContext,
        audioUrl: string,
        effectVolume: number,
        pitchShifter: PitchShift,
        cleanupPitchShift: () => void,
        onPlayFailed: () => void
    ): void {
        const audio = new Audio(audioUrl);
        audio.preload = 'auto';

        const source = audioContext.createMediaElementSource(audio);
        const gainNode = audioContext.createGain();
        gainNode.gain.value = effectVolume;

        source.connect(gainNode);
        gainNode.connect(pitchShifter.node);
        pitchShifter.connect(audioContext.destination);

        const cleanup = () => {
            source.disconnect();
            gainNode.disconnect();
            cleanupPitchShift();
        };

        audio.addEventListener('ended', cleanup, { once: true });

        void audio.play().catch(() => {
            audio.removeEventListener('ended', cleanup);
            cleanup();
            onPlayFailed();
        });
    }

    private applyVolumeToMusicSource(): void {
        for (let [key, musicSourceData] of this._musicSources) {
            musicSourceData.audioSource.volume = musicSourceData.volumeMultiplier * musicSourceData.assignedVolume * this.volumesByTypes.get(SoundType.Master) * this.volumesByTypes.get(SoundType.Music);
        }
    }

    private applyVolumeToLoopSource(): void {
        for (let [key, loopSourceData] of this._loopsSources) {
            loopSourceData.audioSource.volume = loopSourceData.volumeMultiplier * loopSourceData.assignedVolume * this.volumesByTypes.get(SoundType.Master) * this.volumesByTypes.get(SoundType.Effects);
        }
    }

    private getMusicSource(musicName: string): AudioSourceData {
        if (this._musicSources.has(musicName))
            return this._musicSources.get(musicName);

        return null;
    }

    private isPitchShiftSupported(): boolean {
        return sys.isBrowser && typeof AudioContext !== 'undefined';
    }

    private initPitchShiftPool(audioContext: AudioContext): void {
        if (this._pitchShiftPoolInitialized)
            return;

        for (let i = 0; i < this.maxPlayedEffectsCount; i++) {
            this._pitchShiftPool.push(new PitchShift(audioContext));
        }

        this._pitchShiftPoolInitialized = true;
    }

    private acquirePitchShifter(audioContext: AudioContext): PitchShift | null {
        this.initPitchShiftPool(audioContext);

        if (this._pitchShiftPool.length === 0)
            return null;

        return this._pitchShiftPool.pop();
    }

    private releasePitchShifter(audioContext: AudioContext): void {
        this._pitchShiftPool.push(new PitchShift(audioContext));
    }

    private getAudioContext(): AudioContext | null {
        if (!this.isPitchShiftSupported())
            return null;

        if (!this._audioContext) {
            this._audioContext = new AudioContext();
        }

        return this._audioContext;
    }
}