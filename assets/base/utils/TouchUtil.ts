import { _decorator, Camera, geometry, Node, PhysicsRayResult, PhysicsSystem, Vec2 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('TouchUtil')
export class TouchUtil
{
    /**
     * Метод возвращиет PhysicsRayResult по указанной части имени ноды
     * @param closest способ определения попадания ближайший если true и первый из списка если false
     * @param objectName часть имени ноды по которой ишем объект
     * @param location координата
     * @param camera камера
     * @returns возвражает PhysicsRayResult или null если нет найденных объектов удовлетворяющих условию
     */
    public static getRayResultToNodeByName(closest:boolean, objectName:string, location:Vec2, camera:Camera):PhysicsRayResult
    {
        let rayResult:PhysicsRayResult = null;

        if (PhysicsSystem.instance)
        {
            const ray:geometry.Ray = new geometry.Ray();
            camera.screenPointToRay(location.x, location.y, ray);

            if (closest)
            {
                PhysicsSystem.instance.raycastClosest(ray);
                const raycastClosestResult:PhysicsRayResult = PhysicsSystem.instance.raycastClosestResult;

                if (raycastClosestResult)
                {
                    if (raycastClosestResult.collider.node.name.includes(objectName))
                        rayResult = raycastClosestResult;
                }
            }
            else
            {
                PhysicsSystem.instance.raycast(ray);
                const raycastResults:PhysicsRayResult[] = PhysicsSystem.instance.raycastResults;

                if (raycastResults.length > 0)
                {
                    for (let i = 0; i < raycastResults.length; i++)
                    {
                        const raycastResult:PhysicsRayResult = raycastResults[i];
                        const hitNode:Node = raycastResult.collider.node;
                        
                        if (hitNode.name.includes(objectName))
                        {
                            rayResult = raycastResult;
                            break;
                        }
                    }
                }
            }
        }
        
        return rayResult;
    }
}