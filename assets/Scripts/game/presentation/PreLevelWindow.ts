import { _decorator, Button, CCInteger, CCString, Component, Label, SpriteFrame } from 'cc';
import { World } from '../domain/World';
import { Progress } from '../application/Progress';
import { GameFlow } from '../application/GameFlow';
import { GeneratorReward, GeneratorRewardRules, formatCountdown } from '../application/GeneratorReward';
import type { PartyMember } from '../application/Party';
import { PreLevelCard } from './PreLevelCard';
import { SpriteStyle, ZombieLook } from './SpriteStyle';

const { ccclass, property } = _decorator;

@ccclass('ZombieSkin')
export class ZombieSkin {
    @property({  }) name = '';
    @property({ type: CCInteger, min: 0 }) reviveCost = 10;
    @property({ type: SpriteFrame }) frame: SpriteFrame | null = null;
}

export interface ZombieCatalog {
    kindName(kind: number): string;
    kindFrame(kind: number): SpriteFrame | null;
    reviveCost(kind: number): number;
    growthCaption(growth: number): string;
    growthProgress(growth: number): string;
}

interface PreLevelActions { road: () => void; claim: () => void; collection?: () => void; store?: (id: number) => void; eggs?: () => void }

@ccclass('PreLevelWindow')
export class PreLevelWindow extends Component implements ZombieCatalog {
    @property({ type: [ZombieSkin] })
    skins: ZombieSkin[] = [];
    @property({ type: [CCString] })
    growthCaptions: string[] = ['Малыш', 'Подросток', 'Взрослый'];
    @property({ type: CCInteger, min: 1 }) maxGrowth = 8;
    @property({ type: ZombieLook })
    zombieLook = new ZombieLook();
    @property({ type: CCInteger, min: 0 }) claimCoins = 60;
    @property({ min: 0.01 }) claimIntervalHours = 6;
    @property({ type: SpriteFrame }) cardFrame: SpriteFrame | null = null;
    @property({ type: SpriteFrame }) selectedCardFrame: SpriteFrame | null = null;
    @property({ min: 1 }) pictureMaxWidth = 110;
    @property({ min: 1 }) pictureMaxHeight = 76;
    @property(Label) title!: Label;
    @property(Label) coins!: Label;
    @property({ type: Label }) batchLabel!: Label;
    @property(Label) claimLabel!: Label;
    @property(Label) claimTimer!: Label;
    @property({ type: [PreLevelCard] })
    cards: PreLevelCard[] = [];
    @property(Button) roadButton!: Button;
    @property(Button) claimButton!: Button;
    @property({ type: Button }) collectionButton: Button | null = null;
    @property({ type: Button }) toCollectionButton: Button | null = null;
    @property({ type: Button }) eggsButton: Button | null = null;
    @property({ type: Label }) eggsLabel: Label | null = null;
    @property({  }) eggsText = 'Яйца';

    selectedIndex = -1;
    private lineup: readonly PartyMember[] = [];
    private bindings: Array<{ button: Button; handler: () => void }> = [];
    private warnedCards = 0;
    private shown = 0;

    get rewardRules(): GeneratorRewardRules { return { coins: this.claimCoins, intervalHours: this.claimIntervalHours }; }

    get kindCount(): number { return Math.max(1, this.kinds().length); }

    bind(actions: PreLevelActions): void {
        this.unbind();
        this.listen(this.roadButton, actions.road);
        this.listen(this.claimButton, actions.claim);
        if (this.collectionButton && actions.collection) this.listen(this.collectionButton, actions.collection);
        else if (!this.collectionButton) console.warn('PreLevelWindow: не назначена Collection Button');
        if (this.toCollectionButton && actions.store) this.listen(this.toCollectionButton, () => {
            const id = this.selectedMemberId;
            if (id === undefined) return;
            this.selectedIndex = -1;
            actions.store!(id);
        });
        else if (!this.toCollectionButton) console.warn('PreLevelWindow: не назначена To Collection Button');
        if (this.eggsButton && actions.eggs) this.listen(this.eggsButton, actions.eggs);
        else if (!this.eggsButton) console.warn('PreLevelWindow: не назначена Eggs Button');
        this.cards.forEach((card, index) => { if (card?.button) this.listen(card.button, () => this.select(index)); });
    }
    unbind(): void {
        for (const { button, handler } of this.bindings) button.node.off(Button.EventType.CLICK, handler, this);
        this.bindings.length = 0;
    }
    private listen(button: Button, handler: () => void): void {
        if (!button) throw new Error('PreLevelWindow: не назначена кнопка в инспекторе');
        button.node.on(Button.EventType.CLICK, handler, this);
        this.bindings.push({ button, handler });
    }
    protected onDestroy(): void { this.unbind(); }

    select(index: number): void {
        if (index < 0 || index >= Math.min(this.shown, this.cards.length)) return;
        this.selectedIndex = index;
        this.markSelection();
    }

    get selectedMemberId(): number | undefined {
        return this.selectedIndex >= 0 ? this.lineup[this.selectedIndex]?.id : undefined;
    }

    refresh(world: World, progress: Progress, flow: GameFlow, reward: GeneratorReward, now: number): void {
        const visible = flow.screen === 'prelevel';
        if (this.node.active !== visible) this.node.active = visible;
        if (!visible) return;
        const count = world.zombies.length;
        if (this.lineup !== flow.lineup) { this.lineup = flow.lineup; this.selectedIndex = -1; }
        this.title.string = flow.levelName;
        this.coins.string = `Монеты ${progress.data.coins}`;
        this.batchLabel.string = `В партии ${count} / ${flow.partyLimit}`;
        this.fillCards(flow.lineup, count);
        this.roadButton.interactable = count > 0;
        if (this.collectionButton) this.collectionButton.interactable = true;
        if (this.toCollectionButton) this.toCollectionButton.interactable = this.selectedMemberId !== undefined;
        if (this.eggsButton) this.eggsButton.interactable = progress.eggs > 0;
        if (this.eggsLabel) this.eggsLabel.string = `${this.eggsText} · ${progress.eggs}`;
        const wait = reward.remaining(now);
        this.claimButton.interactable = wait === 0;
        this.claimLabel.string = `Забрать · ${reward.coins} монет`;
        const timer = wait === 0 ? 'Можно забрать' : `Следующая через ${formatCountdown(wait)}`;
        if (this.claimTimer.string !== timer) this.claimTimer.string = timer;
    }

    private fillCards(lineup: readonly PartyMember[], count: number): void {
        if (this.cards.length < count && this.warnedCards !== count) {
            this.warnedCards = count;
            console.warn(`PreLevelWindow: в контейнере ${this.cards.length} карточек, а зомби ${count}. Продублируй карточку в Skins и добавь её в Cards.`);
        }
        this.shown = count;
        if (this.selectedIndex >= Math.min(count, this.cards.length)) this.selectedIndex = -1;
        this.cards.forEach((card, index) => {
            const show = index < count;
            if (card.node.active !== show) card.node.active = show;
            if (!show) return;
            card.show(lineup[index] ?? { id: 0, kind: index % this.kindCount, growth: 0 }, this, this.pictureMaxWidth, this.pictureMaxHeight);
        });
        this.markSelection();
    }
    private kinds(): ZombieSkin[] { return this.skins.filter(s => !!s); }
    private kind(kind: number): ZombieSkin | null {
        const kinds = this.kinds();
        return kinds.length ? kinds[((kind % kinds.length) + kinds.length) % kinds.length] : null;
    }
    kindName(kind: number): string { return this.kind(kind)?.name ?? ''; }
    kindFrame(kind: number): SpriteFrame | null { return this.kind(kind)?.frame ?? null; }
    reviveCost(kind: number): number { return Math.max(0, Math.floor(this.kind(kind)?.reviveCost ?? 0)); }
    growthCaption(growth: number): string {
        const list = this.growthCaptions ?? [];
        return list.length ? list[Math.max(0, Math.min(list.length - 1, Math.floor(growth)))] : '';
    }
    growthProgress(growth: number): string {
        const max = Math.max(1, Math.floor(this.maxGrowth) || 1);
        return `Рост ${Math.max(0, Math.min(max, Math.floor(growth)))}/${max}`;
    }

    zombieStyles(): Array<SpriteStyle | null> {
        const look = this.zombieLook ?? new ZombieLook();
        return this.kinds().map(kind => kind.frame ? look.toStyle(kind.frame) : null);
    }
    private markSelection(): void {
        this.cards.forEach((card, index) => {
            const on = index === this.selectedIndex;
            if (card.selectedBadge && card.selectedBadge.active !== on) card.selectedBadge.active = on;
            const frame = on ? this.selectedCardFrame : this.cardFrame;
            if (card.body && frame && card.body.spriteFrame !== frame) card.body.spriteFrame = frame;
        });
    }
}
