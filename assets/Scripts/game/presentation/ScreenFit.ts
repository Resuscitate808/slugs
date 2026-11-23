export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;
export const HUD_STRIP_HEIGHT = 88;

export type FitMode = 'height' | 'width';

export function fitMode(frameWidth: number, frameHeight: number): FitMode {
    if (frameWidth <= 0 || frameHeight <= 0) return 'height';
    return frameWidth / frameHeight >= DESIGN_WIDTH / DESIGN_HEIGHT ? 'height' : 'width';
}

export function visibleSizeFor(frameWidth: number, frameHeight: number): { width: number; height: number } {
    if (frameWidth <= 0 || frameHeight <= 0) return { width: DESIGN_WIDTH, height: DESIGN_HEIGHT };
    return fitMode(frameWidth, frameHeight) === 'height'
        ? { width: DESIGN_HEIGHT * frameWidth / frameHeight, height: DESIGN_HEIGHT }
        : { width: DESIGN_WIDTH, height: DESIGN_WIDTH * frameHeight / frameWidth };
}

export function playableFraction(visibleHeight: number): number {
    return visibleHeight > HUD_STRIP_HEIGHT ? (visibleHeight - HUD_STRIP_HEIGHT) / visibleHeight : 1;
}
