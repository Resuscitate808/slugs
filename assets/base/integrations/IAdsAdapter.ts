
export enum AdsEvents {
    RewardedAdCompleted = "RewardedAdCompleted",
    RewardedAdOpened = "RewardedAdOpened",
    RewardedAdClosed = "RewardedAdClosed",
    FullscreenAdOpened = "FullscreenAdOpened",
    FullscreenAdClosed = "FullscreenAdClosed"
}

export interface IAdsAdapter {
    showRewardedAd(placementId: string);
    showFullscrenAd();
    hideSticky();
    hasRewardedAd(): Promise<boolean>
}

export const IAdsAdapter = Symbol("IAdsAdapter");