import { _decorator, EventTarget, Enum } from 'cc';

export enum DefaultEvent {
    PAUSE_ON = "pause_on",
    PAUSE_OFF = "pause_off",
}
Enum(DefaultEvent);

export interface IEventBus
{
    eventTarget: EventTarget;
}
export const IEventBus = Symbol("IEventBus");

export class EventBus implements IEventBus{
    public eventTarget: EventTarget = new EventTarget();
}