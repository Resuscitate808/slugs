import { ILeaderboardAdapter, LeaderboardEntryData } from '../ILeaderboardAdapter';
import { Inject, InjectBase } from '../../controllers/ServiceLocator';
import { IPlatformAdapter } from '../IPlatformAdapter';
import { YPlatformAdapter } from './YPlatformAdapter';


export class YLeaderboardAdapter implements ILeaderboardAdapter {

    @Inject(IPlatformAdapter)
    private platformAdapter: IPlatformAdapter;

    constructor() {
        InjectBase(this); 
    }

    public async setScore(leaderboardName: string, score: number): Promise<void> {
        const ysdk = (this.platformAdapter as YPlatformAdapter).ysdk
        await ysdk.leaderboards.setScore(leaderboardName, score);
    }

    public async getRank(leaderboardName: string): Promise<number> {
        try {
            const ysdk = (this.platformAdapter as YPlatformAdapter).ysdk
            const res = await ysdk.leaderboards.getPlayerEntry(leaderboardName);

            console.log(res);
            return res.rank;
        } catch (err) {
            if (err.code === 'LEADERBOARD_PLAYER_NOT_PRESENT') {
                return 0; // Игрок не имеет записи в таблице лидеров
            }
        }
    }

    public async getEntries(leaderboardName: string, count: number): Promise<LeaderboardEntryData[]> {
        const ysdk = (this.platformAdapter as YPlatformAdapter).ysdk
        const entries = await ysdk.leaderboards.getEntries(leaderboardName, {
            quantityTop: count,
            includeUser: true,
            quantityAround: 3
        });

        console.log(entries);
        return entries.entries.map(entry => ({
            rank: entry.rank,
            name: entry.player.publicName,
            score: entry.score,
            isCurrentPlayer: entry.player.id === (this.platformAdapter as YPlatformAdapter).player.id
        }));
    }
}