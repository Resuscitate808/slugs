import { _decorator, Button, Component, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { GameFlow } from '../application/GameFlow';
import { Progress } from '../application/Progress';
import type { PartyMember } from '../application/Party';
import { PreLevelCard, fitInto } from './PreLevelCard';
import type { ZombieCatalog } from './PreLevelWindow';

const { ccclass, property } = _decorator;

interface CollectionActions { back: () => void; take: (id: number) => boolean }

@ccclass('CollectionWindow')
export class CollectionWindow extends Component {
    @property({ type: Label }) coins!: Label;
    @property({ type: Label }) partyLabel!: Label;
    @property(Button) backButton!: Button;
    @property({ type: [PreLevelCard] })
    cards: PreLevelCard[] = [];
    @property({ type: Node }) empty!: Node;
    @property({ type: Node }) details!: Node;
    @property({ type: Node }) detailsEmpty!: Node;
    @property({ type: Sprite }) picture!: Sprite;
    @property(UITransform) pictureTransform!: UITransform;
    @property({ type: Label }) nameLabel!: Label;
    @property({ type: Label }) caption!: Label;
    @property(Button) toPartyButton!: Button;
    @property({ type: Label }) toPartyLabel!: Label;
    @property({ type: Label }) footer!: Label;
    @property({ min: 1 }) pictureMaxWidth = 110;
    @property({ min: 1 }) pictureMaxHeight = 76;
    @property({ min: 1 }) detailPictureMax = 150;
    @property({  }) nameSuffix = 'слизень';
    @property({  }) addText = 'В партию';
    @property({  }) replaceText = 'Заменить выбранного';
    @property({  }) footerText = 'Если партия полная, этот слизень заменит выбранного на подготовке.';
    @property({  }) fullFooterText = 'Партия полная: сначала выбери слизня на подготовке, его заменит этот.';

    catalog: ZombieCatalog | null = null;
    isOpen = false;
    selectedIndex = -1;
    private cardFrame: SpriteFrame | null = null;
    private selectedCardFrame: SpriteFrame | null = null;
    private members: readonly PartyMember[] = [];
    private bindings: Array<{ button: Button; handler: () => void }> = [];
    private warned = false;

    setCardFrames(normal: SpriteFrame | null, selected: SpriteFrame | null): void { this.cardFrame = normal; this.selectedCardFrame = selected; }

    get selectedMemberId(): number | undefined { return this.members[this.selectedIndex]?.id; }

    open(): void { this.isOpen = true; this.selectedIndex = -1; }
    close(): void { this.isOpen = false; this.selectedIndex = -1; }

    bind(actions: CollectionActions): void {
        this.unbind();
        this.listen(this.backButton, actions.back);
        this.listen(this.toPartyButton, () => {
            const id = this.selectedMemberId;
            if (id !== undefined && actions.take(id)) this.selectedIndex = -1;
        });
        this.cards.forEach((card, i) => { if (card?.button) this.listen(card.button, () => this.select(i)); });
    }
    unbind(): void {
        for (const { button, handler } of this.bindings) button.node.off(Button.EventType.CLICK, handler, this);
        this.bindings.length = 0;
    }
    private listen(button: Button, handler: () => void): void {
        if (!button) throw new Error('CollectionWindow: не назначена кнопка в инспекторе');
        button.node.on(Button.EventType.CLICK, handler, this);
        this.bindings.push({ button, handler });
    }
    protected onDestroy(): void { this.unbind(); }

    select(index: number): void {
        if (index < 0 || index >= Math.min(this.members.length, this.cards.length)) return;
        this.selectedIndex = index;
        this.markSelection();
    }

    refresh(flow: GameFlow, progress: Progress, replaceId: number | undefined): void {
        if (flow.screen !== 'prelevel') this.isOpen = false;
        const visible = this.isOpen;
        if (this.node.active !== visible) this.node.active = visible;
        if (!visible) return;
        if (this.members !== progress.collection) { this.members = progress.collection; if (this.selectedIndex >= this.members.length) this.selectedIndex = -1; }
        const members = this.members, catalog = this.catalog;
        this.coins.string = `Монеты ${progress.data.coins}`;
        this.partyLabel.string = `В партии ${progress.party.length} / ${flow.partyLimit}`;
        if (this.empty.active !== (members.length === 0)) this.empty.active = members.length === 0;
        if (!this.warned && this.cards.length < members.length) {
            this.warned = true;
            console.warn(`CollectionWindow: карточек ${this.cards.length}, а слизней в коллекции ${members.length}. Продублируй карточку и добавь её в Cards.`);
        }
        this.cards.forEach((card, i) => {
            const member = members[i];
            if (card.node.active !== !!member) card.node.active = !!member;
            if (!member || !catalog) return;
            card.show(member, catalog, this.pictureMaxWidth, this.pictureMaxHeight, catalog.growthProgress(member.growth));
        });
        const full = flow.partyFull;
        const member = members[this.selectedIndex];
        if (this.details.active !== !!member) this.details.active = !!member;
        if (this.detailsEmpty.active !== !member) this.detailsEmpty.active = !member;
        this.toPartyLabel.string = full ? this.replaceText : this.addText;
        this.toPartyButton.interactable = !!member && (!full || replaceId !== undefined);
        this.footer.string = full && replaceId === undefined ? this.fullFooterText : this.footerText;
        if (member && catalog) {
            const frame = catalog.kindFrame(member.kind);
            if (frame) this.picture.spriteFrame = frame;
            fitInto(this.pictureTransform, this.picture.spriteFrame, this.detailPictureMax, this.detailPictureMax);
            const name = catalog.kindName(member.kind);
            this.nameLabel.string = this.nameSuffix ? `${name} ${this.nameSuffix}` : name;
            this.caption.string = `${catalog.growthCaption(member.growth)} · ${catalog.growthProgress(member.growth).toLowerCase()}`;
        }
        this.markSelection();
    }

    private markSelection(): void {
        this.cards.forEach((card, i) => {
            const on = i === this.selectedIndex;
            if (card.selectedBadge && card.selectedBadge.active !== on) card.selectedBadge.active = on;
            const frame = on ? this.selectedCardFrame : this.cardFrame;
            if (card.body && frame && card.body.spriteFrame !== frame) card.body.spriteFrame = frame;
        });
    }
}
