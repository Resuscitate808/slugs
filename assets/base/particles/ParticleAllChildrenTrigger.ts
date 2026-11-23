import { _decorator, CCBoolean, Component, Enum, Node, ParticleSystem, UIOpacity } from 'cc';
const { ccclass, property } = _decorator;

export enum ParticleAllChildrenTriggerEvent
{
    STARTED = "started",
    COMPLETED = "completed"
}
Enum(ParticleAllChildrenTriggerEvent);

@ccclass('ParticleAllChildrenTrigger')
export class ParticleAllChildrenTrigger extends Component
{
    @property
    private playOnLoad:Boolean = false;

    @property
    private emitEvents:Boolean = false;

    private _readyToPlay:boolean = false;
    private _particleSystems:ParticleSystem[] = [];
    private _isPlaying:boolean = false;
    private _isPlayingCounter:boolean = false;

    onLoad()
    {
        const rootParticleSystem:ParticleSystem = this.getComponent(ParticleSystem);

        this._readyToPlay = rootParticleSystem != undefined && rootParticleSystem != null;
        this._particleSystems = rootParticleSystem.getComponentsInChildren(ParticleSystem);
        this._particleSystems.unshift(rootParticleSystem);

        if (this.playOnLoad)
            this.play();
    }

    update(deltaTime:number)
    {
        if (this.emitEvents && this._isPlaying)
        {
            this._isPlayingCounter = false;

            for (const particleSystem of this._particleSystems)
            {
                if (particleSystem.isPlaying)
                    this._isPlayingCounter = true;

                if (this._isPlayingCounter)
                    break;
            }

            if (!this._isPlayingCounter)
            {
                this._isPlaying = false;
                this.node.emit(ParticleAllChildrenTriggerEvent.COMPLETED, this);
            }
        }
    }

    public play():void
    {
        if (this._readyToPlay)
        {
            this._particleSystems.forEach((particleSystem:ParticleSystem) => {
                particleSystem.play();
            });

            if (this.emitEvents)
                this.node.emit(ParticleAllChildrenTriggerEvent.STARTED, this);

            this._isPlaying = true;
        }
    }
}