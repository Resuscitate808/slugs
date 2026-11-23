import { _decorator, Button, Color, Component, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { GameFlow } from '../application/GameFlow';
import { Progress } from '../application/Progress';
import { sellPrice, type PartyMember, type RoundOutcome } from '../application/Party';
import { PreLevelCard, fitInto } from './PreLevelCard';
import { FallenRow } from './FallenRow';
import type { ZombieCatalog } from './PreLevelWindow';
import { ReviveEffect } from './ReviveEffect';

const { ccclass, property } = _decorator;

interface PostLevelActions { next: () => void; revive: (index: number, cost: number) => boolean; store?: (id: number) => boolean; sell?: (id: number, price: number) => boolean }

@ccclass('PostLevelWindow')
export class PostLevelWindow extends Component {
    @property revivalEnabled = true;
    @property({ type: Label }) title!: Label;
    @property({  }) wonTitle = 'ПАРТИЯ ДОСТАВЛЕНА!';
    @property({  }) lostTitle = 'НЕ ВСЕ ДОБРАЛИСЬ';
    @property({ type: Sprite }) headerBackground: Sprite | null = null;
    @property({  }) wonHeaderColor = new Color(0xc8, 0xe5, 0x7a, 255);
    @property({  }) lostHeaderColor = new Color(0xff, 0xab, 0x8d, 255);
    @property({ type: Label }) nextLabel: Label | null = null;
    @property({  }) wonButtonText = 'Дальше';
    @property({  }) lostButtonText = 'Повторить';
    @property({ type: Label }) earned!: Label;
    @property({ type: Label }) coins!: Label;
    @property({ type: Label }) summary!: Label;
    @property(Label) deliveredTitle!: Label;
    @property(Label) fallenTitle!: Label;
    @property({ type: Node }) growthBadge!: Node;
    @property({ type: Node }) deliveredEmpty!: Node;
    @property({ type: Node }) fallenEmpty!: Node;
    @property({ type: [PreLevelCard] })
    cards: PreLevelCard[] = [];
    @property({ type: [FallenRow] })
    rows: FallenRow[] = [];
    @property({ type: Sprite }) selectedPicture!: Sprite;
    @property(UITransform) selectedPictureTransform!: UITransform;
    @property({ type: Label }) selectedLabel!: Label;
    @property(Button) nextButton!: Button;
    @property({ type: Button }) toCollectionButton: Button | null = null;
    @property({ type: Button }) sellButton: Button | null = null;
    @property({ type: Label }) sellLabel: Label | null = null;
    @property({  }) sellText = 'Продать';
    @property({ min: 0 }) sellStep = 80;
    @property({ type: Label }) footer: Label | null = null;
    @property({  }) wonFooter = 'Не воскрешённые сбитые не пойдут на следующий уровень.';
    @property({  }) lostFooter = 'Невоскрешённые слизни будут потеряны даже при повторе.';
    @property({ min: 1 }) pictureMaxWidth = 90;
    @property({ min: 1 }) pictureMaxHeight = 62;
    @property({ min: 1 }) rowPictureMax = 56;
    @property({ type: ReviveEffect })
    reviveEffect: ReviveEffect | null = null;

    catalog: ZombieCatalog | null = null;
    selectedIndex = -1;
    private cardFrame: SpriteFrame | null = null;
    private selectedCardFrame: SpriteFrame | null = null;
    private outcome: RoundOutcome | null = null;
    private shown: Array<{ member: PartyMember; revived: boolean }> = [];
    private bindings: Array<{ button: Button; handler: () => void }> = [];
    private warned = false;
    private pendingReviveId: number | null = null;
    private startingRevive = false;

    setCardFrames(normal: SpriteFrame | null, selected: SpriteFrame | null): void { this.cardFrame = normal; this.selectedCardFrame = selected; }

    bind(actions: PostLevelActions): void {
        this.unbind();
        this.listen(this.nextButton, actions.next);
        if (this.toCollectionButton && actions.store) this.listen(this.toCollectionButton, () => {
            const entry = this.shown[this.selectedIndex];
            if (!entry || !actions.store!(entry.member.id)) return;
            this.selectedIndex = -1;
        });
        if (this.sellButton && actions.sell) this.listen(this.sellButton, () => {
            const entry = this.shown[this.selectedIndex];
            if (!entry || !actions.sell!(entry.member.id, this.priceOf(entry.member))) return;
            this.selectedIndex = -1;
        });
        else if (!this.sellButton) console.warn('PostLevelWindow: не назначена Sell Button');
        this.cards.forEach((card, i) => { if (card?.button) this.listen(card.button, () => this.select(i)); });
        this.rows.forEach((row, i) => {
            if (row?.reviveButton) this.listen(row.reviveButton, () => {
                this.resolveResultParts();
                if (this.reviveEffect?.node.active) return;
                const entry = this.outcome?.fallen[i];
                if (!entry || entry.revived || !this.catalog || this.startingRevive) return;
                this.pendingReviveId = entry.member.id;
                this.startingRevive = true;
                let revived = false;
                try {
                    revived = actions.revive(i, this.catalog.reviveCost(entry.member.kind));
                    if (revived) this.reviveEffect?.play();
                } finally {
                    this.startingRevive = false;
                    if (!revived || !this.reviveEffect) this.pendingReviveId = null;
                }
                if (!revived) return;
                if (this.reviveEffect) {
                    this.rows.forEach(item => { if (item?.reviveButton) item.reviveButton.interactable = false; });
                }
                else console.warn('PostLevelWindow: нет узла PostLevel/ReviveFx с ReviveEffect — сцена в редакторе устарела, переоткрой её с диска');
            });
        });
    }
    unbind(): void {
        for (const { button, handler } of this.bindings) button.node.off(Button.EventType.CLICK, handler, this);
        this.bindings.length = 0;
    }
    private listen(button: Button, handler: () => void): void {
        if (!button) throw new Error('PostLevelWindow: не назначена кнопка в инспекторе');
        button.node.on(Button.EventType.CLICK, handler, this);
        this.bindings.push({ button, handler });
    }
    protected onDestroy(): void { this.unbind(); }

    reset(): void {
        this.resolveResultParts();
        this.reviveEffect?.cancel();
        this.pendingReviveId = null;
        this.startingRevive = false;
        this.outcome = null;
        this.shown = [];
        this.selectedIndex = -1;
        this.node.active = false;
    }

    select(index: number): void {
        if (!this.outcome || index < 0 || index >= Math.min(this.shown.length, this.cards.length)) return;
        this.selectedIndex = index;
        this.markSelection();
    }

    refresh(flow: GameFlow, progress: Progress): void {
        const result = flow.world.result;
        const visible = flow.revivalEnabled && flow.screen === 'result' && !flow.resultIntro && !!result && !!flow.outcome;
        if (this.node.active !== visible) this.node.active = visible;
        if (!visible || !result || !flow.outcome) return;
        if (this.outcome !== flow.outcome) { this.outcome = flow.outcome; this.selectedIndex = -1; this.pendingReviveId = null; }
        if (!this.startingRevive && !this.reviveEffect?.node.active) this.pendingReviveId = null;
        const { delivered, fallen } = flow.outcome;
        const inParty = new Set(progress.party.map(m => m.id));
        this.shown = [
            ...delivered.map(member => ({ member, revived: false })),
            ...fallen.filter(e => e.revived && e.member.id !== this.pendingReviveId).map(e => ({ member: e.member, revived: true })),
        ].filter(e => inParty.has(e.member.id));
        if (this.selectedIndex >= this.shown.length) this.selectedIndex = -1;
        const shown = this.shown;
        const revivedCount = shown.filter(e => e.revived).length;
        const catalog = this.catalog;
        this.resolveResultParts();
        this.title.string = result.won ? this.wonTitle : this.lostTitle;
        if (this.headerBackground) this.headerBackground.color = result.won ? this.wonHeaderColor : this.lostHeaderColor;

        if (this.nextLabel) this.nextLabel.string = result.won ? this.wonButtonText : this.lostButtonText;
        this.earned.string = `Монеты +${result.coins}`;
        this.coins.string = `Монеты ${progress.data.coins}`;
        this.summary.string = `Спасено ${result.saved}/${result.total} · цель ${flow.target} · ${result.stars ? '★'.repeat(result.stars) : '☆'}${progress.available ? '' : ' · сохранение недоступно'}`;
        const deliveredLeft = shown.length - revivedCount;
        this.deliveredTitle.string = revivedCount ? `Доставленные: ${deliveredLeft} · воскрешены: ${revivedCount}` : `Доставленные: ${deliveredLeft}`;
        this.fallenTitle.string = `Сбитые: ${fallen.length}`;
        if (this.footer) this.footer.string = result.won ? this.wonFooter : this.lostFooter;
        if (this.growthBadge.active !== deliveredLeft > 0) this.growthBadge.active = deliveredLeft > 0;
        if (this.deliveredEmpty.active !== (shown.length === 0)) this.deliveredEmpty.active = shown.length === 0;
        if (this.fallenEmpty.active !== (fallen.length === 0)) this.fallenEmpty.active = fallen.length === 0;
        if (!this.warned && (this.cards.length < shown.length || this.rows.length < fallen.length)) {
            this.warned = true;
            console.warn(`PostLevelWindow: карточек ${this.cards.length}, строк ${this.rows.length}, а зомби больше. Продублируй карточку/строку и добавь её в Cards/Rows.`);
        }
        this.cards.forEach((card, i) => {
            const entry = shown[i];
            if (card.node.active !== !!entry) card.node.active = !!entry;
            if (!entry || !catalog) return;
            const caption = `${catalog.growthCaption(entry.member.growth)}${entry.revived ? ' · воскрешён' : ''}`;
            card.show(entry.member, catalog, this.pictureMaxWidth, this.pictureMaxHeight, caption);
        });
        this.rows.forEach((row, i) => {
            const entry = fallen[i];
            if (row.node.active !== !!entry) row.node.active = !!entry;
            if (!entry || !catalog) return;
            const frame = catalog.kindFrame(entry.member.kind);
            if (frame) row.picture.spriteFrame = frame;
            fitInto(row.pictureTransform, row.picture.spriteFrame, this.rowPictureMax, this.rowPictureMax);
            row.title.string = catalog.kindName(entry.member.kind);
            const cost = catalog.reviveCost(entry.member.kind);
            row.reviveLabel.string = entry.revived ? 'Воскрешён' : `Воскресить · ${cost}`;
            row.reviveButton.interactable = !this.reviveEffect?.node.active && !entry.revived;
        });
        this.markSelection();
    }

    private resolveResultParts(): void {
        const find = (this.node as Node & { getChildByPath?: (p: string) => Node | null }).getChildByPath?.bind(this.node);
        if (!find) return;
        if (!this.headerBackground) this.headerBackground = find('Header/Fill')?.getComponent(Sprite) ?? null;
        if (!this.nextLabel) this.nextLabel = find('Next/Fill/NextLabel')?.getComponent(Label) ?? null;
        if (!this.reviveEffect) this.reviveEffect = find('ReviveFx')?.getComponent(ReviveEffect) ?? null;
        if (!this.partsWarned && (!this.headerBackground || !this.nextLabel)) {
            this.partsWarned = true;
            console.warn('PostLevelWindow: назначь Header Background и Next Label в инспекторе, иначе плашка и кнопка не меняются при поражении');
        }
    }
    private partsWarned = false;
    priceOf(member: PartyMember): number { return sellPrice(member.growth, this.sellStep); }
    private markSelection(): void {
        this.cards.forEach((card, i) => {
            const on = i === this.selectedIndex;
            if (card.selectedBadge && card.selectedBadge.active !== on) card.selectedBadge.active = on;
            const frame = on ? this.selectedCardFrame : this.cardFrame;
            if (card.body && frame && card.body.spriteFrame !== frame) card.body.spriteFrame = frame;
        });
        const member = this.shown[this.selectedIndex]?.member;
        const catalog = this.catalog;
        if (this.toCollectionButton) this.toCollectionButton.interactable = !!member;
        if (this.sellButton) this.sellButton.interactable = !!member;
        if (this.sellLabel) this.sellLabel.string = member ? `${this.sellText} за ${this.priceOf(member)}` : this.sellText;
        if (this.selectedPicture && this.selectedPicture.node.active !== !!member) this.selectedPicture.node.active = !!member;
        if (!member || !catalog) { this.selectedLabel.string = 'Выбери слизня'; return; }
        const frame = catalog.kindFrame(member.kind);
        if (frame) this.selectedPicture.spriteFrame = frame;
        fitInto(this.selectedPictureTransform, this.selectedPicture.spriteFrame, this.rowPictureMax, this.rowPictureMax);
        this.selectedLabel.string = `Выбран: ${catalog.kindName(member.kind).toLowerCase()} · ${catalog.growthCaption(member.growth).toLowerCase()}`;
    }
}
