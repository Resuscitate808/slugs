import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

export interface IPurchaseProduct {
    id: string;
    title: string;
    description: string;
    imageURI: string;
    price: string;          // Отформатированная региональная цена, например "100 руб." или "50 Yans"
    priceValue: string;     // Числовое значение цены строкой
    priceCurrencyCode: string; // Код валюты
}

