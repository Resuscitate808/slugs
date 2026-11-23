import { _decorator, Component, Node, v2, Vec2 } from 'cc';
import { Shape } from './Shape';
import { Grid } from '../grids/Grid';
import { Position } from '../enums/Position';
const { ccclass, property } = _decorator;

@ccclass('ShapeFromFlatHexagon')
export class ShapeFromFlatHexagon extends Shape
{
    constructor(grid:Grid, centerPos:Vec2, radius:number, fill:boolean = false)
    {
        super();

        if (radius <= 0)
        {
            this.add(centerPos);
            return;
        }

        let startPos:Vec2 = centerPos.clone();
        
        for (let i = 0; i < radius; i++)
        {
            startPos = grid.getCellNeighbor(startPos, Position.LB);
            
            if (startPos == null)
                return;
        }

        if (fill)
        {
            let lineIter:number = radius + 1;
            let linesIter:number = radius * 2 + 1;
            let cellPos:Vec2 = v2();

            for (let lines = 0; lines < linesIter; lines++)
            {
                cellPos.set(startPos);

                for (let line = 0; line < lineIter; line++)
                {
                    this.add(cellPos.clone());
                    cellPos.set(grid.getCellNeighbor(cellPos, Position.R));
                }

                if (lines < radius)
                {
                    lineIter += 1;
                    startPos.set(grid.getCellNeighbor(startPos, Position.LT));
                }
                else
                {
                    lineIter -= 1;
                    startPos.set(grid.getCellNeighbor(startPos, Position.RT));
                }
            }
        }
        else
        {
            const directions:Position[] = [Position.R, Position.RT, Position.LT, Position.L, Position.LB, Position.RB];

            for (let i = 0; i < directions.length; i++)
            {
                for (let j = 0; j < radius; j++)
                {
                    this.add(startPos.clone());
                    startPos.set(grid.getCellNeighbor(startPos, directions[i]));
                }
            }
        }
    }

    public override isInsideShape(gridPoint:Vec2):boolean
    {
        return false; // TODO: рассчитать
    }
}