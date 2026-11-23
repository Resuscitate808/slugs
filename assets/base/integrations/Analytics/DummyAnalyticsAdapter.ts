import {IAnalyticsAdapter} from "./IAnalyticsAdapter"

export class DummyAnalyticsAdapter implements IAnalyticsAdapter {

    constructor() { }
    setProperty(property_name: string, value: any) {
    }

    public async send(event_name: string, data: { [key: string]: any }) { }
}
