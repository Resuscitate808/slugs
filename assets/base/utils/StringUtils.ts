import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

export function isEmptyOrWhitespace(str: string | null | undefined): boolean {
    if (!str) {
        return true;
    }

    return str.trim().length === 0;
}

