export interface IAnalyticsAdapter {
    send(event_name: string, data: { [key: string]: any });
    setProperty(property_name: string, value: any);
}

export const IAnalyticsAdapter = Symbol("IAnalyticsAdapter");