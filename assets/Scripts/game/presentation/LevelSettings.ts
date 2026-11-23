import { _decorator, CCFloat, Component } from 'cc';
import { GameConfig } from '../domain/Model';
const { ccclass, property } = _decorator;

@ccclass('LevelSettings')
export class LevelSettings extends Component {
    @property({ type: CCFloat, min: 1 }) roadLengthPixels = 3800;
    @property({ type: CCFloat, min: 1 }) roadWorldLength = 36;
    @property({ type: CCFloat, min: 1 }) laneWidthPixels = 220;
    @property({ type: CCFloat, min: 1 }) flightSpeedPixels = 1760;
    @property({ type: CCFloat, min: 1 }) flightMinPixels = 110;
    @property({ type: CCFloat, min: 1 }) flightMaxPixels = 220;
    @property({ type: CCFloat, min: 0 }) queueGapPixels = 55;
    @property({ type: [CCFloat] }) pauseMin = [4, 3, 3, 5, 6];
    @property({ type: [CCFloat] }) pauseMax = [5, 4, 4, 7, 8];

    configure(config: Partial<GameConfig>): Partial<GameConfig> {
        if (!this.enabled) return config;
        const scale = Math.max(0.001, this.roadWorldLength) / Math.max(1, this.roadLengthPixels);
        const depth = scale / (25 / Math.hypot(25, 24));
        return { ...config, levelTable: true, unitsPerPixel: scale, depthPerPixel: depth,
            laneWidths: Array(5).fill(Math.max(1.4, this.laneWidthPixels * depth)),
            flightSpeedPixels: Math.max(1, this.flightSpeedPixels), flightMinPixels: Math.max(1, this.flightMinPixels),
            flightMaxPixels: Math.max(this.flightMinPixels, this.flightMaxPixels), queueGap: Math.max(0, this.queueGapPixels) * scale,
            spawnPauses: this.pauseMin.flatMap((v, i) => [Math.max(0, v), Math.max(v, this.pauseMax[i] ?? v)]),
        };
    }
}
