import { ILeaderboardAdapter, LeaderboardEntryData } from '../ILeaderboardAdapter';

export class DummyLeaderboardAdapter implements ILeaderboardAdapter {
    public async setScore(leaderboardName: string, score: number): Promise<void> {
        console.log(`Setting score ${score} for leaderboard ${leaderboardName}`);
    }

    public async getRank(leaderboardName: string): Promise<number> {
        console.log(`Getting rank for leaderboard ${leaderboardName}`);
        return 0; // Dummy rank
    }

    public async getEntries(leaderboardName: string, count: number): Promise<LeaderboardEntryData[]> {
        console.log(`Getting top ${count} entries for leaderboard ${leaderboardName}`);

        const mockData: LeaderboardEntryData[] = [
            { rank: 1, name: "Человек1", score: 15000, isCurrentPlayer: false },
            { rank: 2, name: "Человек2", score: 12500, isCurrentPlayer: false },
            { rank: 3, name: "Человек3", score: 10200, isCurrentPlayer: false },
            { rank: 4, name: "Человек4", score: 8900, isCurrentPlayer: false },
            { rank: 5, name: "Человек5", score: 7600, isCurrentPlayer: false },
            { rank: 6, name: "Человек6", score: 6500, isCurrentPlayer: false },
            { rank: 7, name: "Человек7", score: 5400, isCurrentPlayer: false },
            { rank: 8, name: "Человек8", score: 4300, isCurrentPlayer: false },
            { rank: 9, name: "Человек9", score: 3200, isCurrentPlayer: false },
            { rank: 10, name: "Человек10", score: 100, isCurrentPlayer: false },

            { rank: 22, name: "Человек11", score: 1100, isCurrentPlayer: false },
            { rank: 23, name: "Человек12", score: 950, isCurrentPlayer: false },
            { rank: 24, name: "Человек13", score: 800, isCurrentPlayer: false },
            { rank: 25, name: "Игрок", score: 650, isCurrentPlayer: true },
            { rank: 26, name: "Человек15", score: 500, isCurrentPlayer: false },
            { rank: 27, name: "Человек16", score: 450, isCurrentPlayer: false },
            { rank: 28, name: "Человек17", score: 300, isCurrentPlayer: false }
        ];

        return mockData; // Dummy entries
    }
}