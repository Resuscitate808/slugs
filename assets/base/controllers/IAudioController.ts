import { _decorator, AudioClip, Enum } from 'cc';

export enum SoundType {
    None = "none",
    Master = "master",
    Music = "music",
    Effects = "effects"
}
Enum(SoundType);

export interface IAudioController {
    playEffect(effectName: string, volume?: number): void;
    playEffectClip(clip: AudioClip, volume?: number): void;
    playEffectWithPitchShift(effectName: string, pitchShift: number, volume?: number): void;
    playLoop(loopName: string, volume?: number): void;
    stopLoop(loopName: string): void
   
    playMusic(musicName: string, loop?: boolean, volume?: number): void;
    playMusicClip(clip: AudioClip, loop?: boolean, volume?: number, key?: string): void;
    stopMusic(musicName: string): void;
    stopAllMusic(): void;

    stopAllLoops(): void;


    isMusicPlaying(musicName: string): boolean;

    getSoundVolume(soundType: SoundType): number;
    setSoundVolume(soundType: SoundType, value: number);

    initilize();
}
export const IAudioController = Symbol("IAudioController");