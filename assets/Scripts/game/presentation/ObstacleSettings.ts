import { _decorator, Component } from 'cc';
import { GameConfig } from '../domain/Model';
const { ccclass, property } = _decorator;

@ccclass('ObstacleSettings')
export class ObstacleSettings extends Component {
    @property obstaclesEnabled = true;
    @property obstaclesVisible = true;

    configure(config: Partial<GameConfig>): Partial<GameConfig> {
        return { ...config, obstaclesEnabled: this.enabled && this.obstaclesEnabled, obstaclesVisible: this.obstaclesVisible };
    }
}
