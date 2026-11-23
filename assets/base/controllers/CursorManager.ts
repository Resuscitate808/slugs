
export class CursorManager 
{
    private _gameCanvas;

    constructor()
    {
        this._gameCanvas = document.getElementById("GameCanvas");
    }

    public setAuto():void
    {
        if (this._gameCanvas.style.cursor == "auto"){
            return;
        }
        this._gameCanvas.style.cursor = "auto";
    }

    public setPointer():void
    {
        if (this._gameCanvas.style.cursor == "pointer"){
            return;
        }
        this._gameCanvas.style.cursor = "pointer";
    }
}