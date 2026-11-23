import { sys } from "cc";
import { IAnalyticsAdapter } from "./IAnalyticsAdapter"

export class JJAnalyticsAdapter implements IAnalyticsAdapter {
    private _isInitialized: boolean = false;

    private _url: string;
    private _apiKey: string;
    private _userId: string;

    private _sessionNumber: number;

    private _eventCache: { [key: string]: any }[] = [];

    private _globalProperties: { [key: string]: any } = {};

    public initialize(app_name: string, url: string, apiKey: string, userId: string, sessionNumber: number) {
        this._url = url;
        this._apiKey = apiKey;
        this._userId = userId;
        this._sessionNumber = sessionNumber;

        this._globalProperties["app_name"] = app_name;

        if (sys.os === sys.OS.ANDROID) {
            this._globalProperties["platform"] = "Android";
        }
        else if (sys.os === sys.OS.IOS) {
            this._globalProperties["platform"] = "iOS";
        }
        else if (sys.os === sys.OS.WINDOWS || sys.os === sys.OS.OSX || sys.os === sys.OS.LINUX) {
            this._globalProperties["platform"] = "PC";
        }

        this._globalProperties["build_version"] = (window as any).build_version || "1.0.0-editor";
        
        this._globalProperties["language"] = sys.language;

        this._isInitialized = true;


        for (const data of this._eventCache) {
            data.user_id = this._userId;
            data.session_number = this._sessionNumber;
            data.data = { ...data.data, ...this._globalProperties };

            this.sendWithRetry(data, 3);
        }
        this._eventCache.length = 0;
    }


    public async send(event_name: string, data: { [key: string]: any }) {

        let _data = {
            user_id: this._userId,
            session_number: this._sessionNumber,
            event_name: event_name,
            created_local: new Date().toISOString(),
            data: { ...data, ...this._globalProperties }
        };

        if (!this._isInitialized) {
            this._eventCache.push(_data);
        }
        else {
            await this.sendWithRetry(_data, 3);
        }
    }

    setProperty(property_name: string, value: any) {
        this._globalProperties[property_name] = value;
    }

    private async sendWithRetry(data: any, maxRetries: number): Promise<void> {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(this._url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': this._apiKey
                    },
                    body: JSON.stringify(data)
                });

                if (response.status === 200) {
                    return;
                }

                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                }
            } catch (error) {
                if (attempt === maxRetries) {
                    console.error('All attempts failed');
                }
            }
        }
    }
}
