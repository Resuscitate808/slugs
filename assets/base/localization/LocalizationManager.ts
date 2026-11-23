import { resources, TextAsset } from "cc";
import { Inject, InjectBase } from '../controllers/ServiceLocator';
import { ILocalizationManager, LocalizationEvent } from "./ILocalizationManager";
import { IEventBus } from "../controllers/EventBus";
import { IPlatformAdapter } from "../integrations/IPlatformAdapter";

export class LocalizationManager implements ILocalizationManager {

    @Inject(IEventBus)
    private _eventBus: IEventBus;

    @Inject(IPlatformAdapter)
    private _platformAdapter: IPlatformAdapter;

    private localization: Record<string, string> = {}; 
    private textAsset:TextAsset;

    private codeLanguages : string[];
    private languages: string[];

    private _currentLanguageCode : string;
    public get currentLanguageCode():string{ return this._currentLanguageCode; }

    constructor(){
        InjectBase(this);
    }

    initilize(){
        let language = this._platformAdapter.getLanguageCode();
        resources.load("localization", TextAsset, (err, text) => {
            this.textAsset = text;
            this.reloadLocalization(language);
            this._eventBus.eventTarget.emit(LocalizationEvent.LOCALIZATION_CHANGED);
        });
    }

    public getLocalization(key:string){
            if(this.localization[key] != undefined){
                return this.localization[key].replace(/###COMMA###+/g, ', ');
            }
            else{
                console.error("Key not found: " + key)
                return key;
            }
    }

    public changeLocalization(language:string){
        this.reloadLocalization(language);
        this._eventBus.eventTarget.emit(LocalizationEvent.LOCALIZATION_CHANGED);
    }

    public getCodeLanguages():string[]{
        return this.codeLanguages;
    }

    public getLanguages():string[]{
        return this.languages;
    }

    private reloadLocalization(language:string){
        var text = this.textAsset.text;
        text = text.replace(/['"]+/g, '');
        text = text.replace(/,\s+/g, "###COMMA###");
        var rows = text.split("\n");
        var headers = rows[0];
        var columns = headers.split(",");
        this.codeLanguages = columns;

        var secondHeaders = rows[1];
        this.languages = secondHeaders.split(",");

        var currentIndex = columns.findIndex((item) => 
            {
                var it = item.trim().replace('\r', '');
                var languges = it.split("|");
                
                return languges.indexOf(language.trim()) != -1;
        });

        console.log("Current language: " + language + ", current index: " + currentIndex + ", current code: " + columns[currentIndex]);

        if (currentIndex == -1){
            currentIndex = columns.findIndex((item) => item.trim() == "en");
        }
        this._currentLanguageCode = columns[currentIndex];

        for(var indexRow = 1;indexRow<rows.length;indexRow++){
            var columns = rows[indexRow].split(",");
            this.localization[columns[0]] = columns[currentIndex];
        }
    } 
}

