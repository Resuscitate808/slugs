

export interface LeaderboardEntryData {
    rank: number;
    name: string;
    score: number;
    isCurrentPlayer: boolean;
}


export interface ILeaderboardAdapter {
    setScore(leaderboardName: string, score: number): Promise<void>;
    getRank(leaderboardName: string): Promise<number>;
    getEntries(leaderboardName: string, count: number): Promise<LeaderboardEntryData[]>;
}

export const ILeaderboardAdapter = Symbol("ILeaderboardAdapter");