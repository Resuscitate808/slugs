import { _decorator, Size, Vec2 } from 'cc';
const { ccclass } = _decorator;

@ccclass('Shape')
export abstract class Shape
{
    protected readonly _positions:Array<Vec2> = new Array<Vec2>();

    protected _size:Size = new Size();
    
    public get size():Size
    {
        return this._size;
    }

    protected _lb:Vec2 = null;
    public get lb():Vec2 { return this._lb; }

    protected _rt:Vec2 = null;
    public get rt():Vec2 { return this._rt; }
    
    public abstract isInsideShape(gridPoint:Vec2):boolean;
    
    public add(position:Vec2):void
    {
        this._positions.push(position);
    }

    public insert(index:number, position:Vec2):void
    {
        this._positions.splice(index, 0, position);
    }

    public addIfNot(position:Vec2):void
    {
        let found:boolean = false;
        
        this._positions.forEach((pos) =>
        {
            if (pos.equals(position))
            {
                found = true;
            }
        });

        if (!found)
        {
            this._positions.push(position);
        }
    }

    public addRow(startCell:Vec2, x:number, y:number):void
    {
        for (let i:number = -x; i <= x; i++)
        {
            this._positions.push(new Vec2(startCell.x + i, startCell.y + y));
        }
    }

    public get():Array<Vec2>
    {
        return this._positions;
    }

    public getLength():number
    {
        return this._positions.length;
    }
}