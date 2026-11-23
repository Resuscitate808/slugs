import { ILeaderboardAdapter, LeaderboardEntryData } from '../ILeaderboardAdapter';
import { Inject, InjectBase } from '../../controllers/ServiceLocator';
import { IPlatformAdapter } from '../IPlatformAdapter';
import { VKPlatformAdapter } from './VKPlatformAdapter';

export class VKLeaderboardAdapter implements ILeaderboardAdapter {

    @Inject(IPlatformAdapter)
    private platformAdapter: IPlatformAdapter;

    constructor() {
        InjectBase(this); 
    }

    /**
     * Записывает результат игрока. 
     * В ВК под leaderboardName понимается числовой ID инстанса/уровня или просто отправка глобального рекорда.
     */
    public async setScore(leaderboardName: string, score: number): Promise<void> {
        const bridge = (this.platformAdapter as VKPlatformAdapter).vkBridge;
        
        try {
            // Отправляем очки в активность ВК. Платформа сама построит топ среди друзей.
            await bridge.send('VKWebAppShowLeaderBoardBox', {
                user_result: score
            });
            console.log(`Результат ${score} успешно отправлен в ВК`);
        } catch (error) {
            console.error('Ошибка отправки результата в лидерборд ВК:', error);
        }
    }

    /**
     * В ВК нет метода для прямого синхронного получения точного ранка текущего игрока "вслепую".
     * Метод возвращает 0 или генерирует открытие нативного окна, чтобы игрок увидел себя.
     */
    public async getRank(leaderboardName: string): Promise<number> {
        console.log('ВК не предоставляет ранк игрока через API без открытия UI. Возвращаем 0.');
        return 0; 
    }

    /**
     * Получает список лидеров.
     * Так как ВК не отдает глобальный топ игроков без собственного бэкенда,
     * этот метод адаптирован под получение списка друзей, запускавших игру (через VK API).
     */
    public async getEntries(leaderboardName: string, count: number): Promise<LeaderboardEntryData[]> {
        const bridge = (this.platformAdapter as VKPlatformAdapter).vkBridge;
        const currentPlayerId = (this.platformAdapter as VKPlatformAdapter).getPlayerId();

        try {
            // Для работы этого метода в настройках приложения ВК должен быть включен доступ к друзьям!
            // Запрашиваем пользователей приложения среди друзей
            const res = await bridge.send('VKWebAppGetFriends', { filter: 'app_users' });
            
            if (!res.users || res.users.length === 0) {
                return [];
            }

            // Ограничиваем количество записей согласно переданному count
            const limitedUsers = res.users.slice(0, count);

            // Маппим данные друзей под ваш интерфейс LeaderboardEntryData
            return limitedUsers.map((user: any, index: number) => {
                const fullName = `${user.first_name} ${user.last_name}`;
                return {
                    rank: index + 1,
                    name: fullName,
                    // Так как ВК не хранит кастомные score в объекте пользователя, 
                    // здесь обычно выводится заглушка или подтягиваются данные, если вы сохраняли их отдельно.
                    score: 0, 
                    isCurrentPlayer: user.id.toString() === currentPlayerId
                };
            });

        } catch (err) {
            console.error('Не удалось получить записи лидерборда из ВК:', err);
            return [];
        }
    }
}
