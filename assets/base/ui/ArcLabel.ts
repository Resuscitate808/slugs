import { _decorator, CCFloat, CCString, Component, instantiate, Label, Node, Prefab, UITransform, v3 } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('ArcLabel')
@executeInEditMode
export class ArcLabel extends Component {
	@property
	private labelText: string = "Arc Label v0.1";

	@property
	private fontSize: number = 40;

	@property
	private lineHeight: number = 40;

	public get text(): string {
		return this.labelText;
	}

	public set text(val: string) {
		this.labelText = val;
		this.rebuildArcText();
	}

	@property
	private labelRadius: number = 200;

	public get radius(): number {
		return this.labelRadius;
	}

	public set radius(val: number) {
		this.labelRadius = val;
		this.rebuildArcText();
	}

	@property({ tooltip: "Расстояние между символами в градусах" })
	private labelSpacingAngle: number = 10;


	public get spacingAngle(): number {
		return this.labelSpacingAngle;
	}

	public set spacingAngle(val: number) {
		this.labelSpacingAngle = val;
		this.rebuildArcText();
	}

	@property({ tooltip: "Начальный угол в градусах (90 - вершина)" })
	private labelStartAngle: number = 90;

	public get startAngle(): number {
		return this.labelStartAngle;
	}

	public set startAngle(val: number) {
		this.labelStartAngle = val;
		this.rebuildArcText();
	}

	// Шаблон для создания символов
	// Если не задан, создаст дефолтные системные Label
	@property({ type: Prefab, tooltip: "Нод-шаблон с компонентом Label (необязательно)" })
	private labeTemplate: Prefab | null = null;

	public get labelTemplate(): Prefab {
		return this.labeTemplate;
	}

	public set labelTemplate(val: Prefab) {
		this.labeTemplate = val;
		this.rebuildArcText();
	}

	protected onLoad() {
		this.rebuildArcText();
	}

	/**
	 * Основной метод пересчета и выстраивания букв по дуге
	 */
	public rebuildArcText() {
		// Очищаем старые символы
		this.node.removeAllChildren();

		if (!this.labelText || this.labelText.length === 0)
			return;

		const len: number = this.labelText.length;

		// Сначала создаем все символы, чтобы получить их реальную ширину
		const charNodes: { node: Node, label: Label, width: number, char: string }[] = [];
		const charAngles: number[] = [];
		let totalAngle: number = 0;

		// Вычисляем угол на пиксель
		const circumference: number = 2 * Math.PI * this.labelRadius;
		const anglePerPixel: number = 360 / circumference;

		for (let i = 0; i < len; i++) {
			const char: string = this.labelText[i];

			let charNode: Node;
			let labelComp: Label;

			if (this.labeTemplate) {
				charNode = instantiate(this.labeTemplate);
				charNode.active = true;

				labelComp = charNode.getComponent(Label)!;
			}
			else {
				charNode = new Node(`char_${i}`);
				charNode.addComponent(UITransform);

				labelComp = charNode.addComponent(Label);
				labelComp.fontSize = this.fontSize;
				labelComp.lineHeight = this.lineHeight;
			}

			labelComp.string = char;

			// Принудительно обновляем, чтобы получить корректные размеры
			this.node.addChild(charNode);

			// Получаем ширину символа
			const uiTransform: UITransform = charNode.getComponent(UITransform);
			let charWidth: number = 30; // fallback

			if (uiTransform) {
				if (uiTransform.width > 0) {
					charWidth = uiTransform.width;
				}
				else {
					const contentSize = uiTransform.contentSize;
					charWidth = contentSize.width > 0 ? contentSize.width : 30;
				}
			}

			// Вычисляем угловой размер символа
			const charAngle: number = charWidth * anglePerPixel;
			charAngles.push(charAngle);

			totalAngle += charAngle + this.labelSpacingAngle;

			charNodes.push({ node: charNode, label: labelComp, width: charWidth, char: char });
		}

		// Убираем последний spacing
		totalAngle -= this.labelSpacingAngle;

		// Вычисляем начальный угол для центрирования
		// Половина общей угловой длины текста
		const halfTotalAngle: number = totalAngle / 2;

		// Накапливаем угол для позиционирования
		let accumulatedAngle: number = 0;

		for (let i = 0; i < len; i++) {
			const charData = charNodes[i];
			const charAngle = charAngles[i];

			// Угол позиции символа: от начального угла отступаем половину общей длины,
			// затем добавляем накопленное смещение и половину ширины текущего символа
			const currentAngleDeg: number = this.labelStartAngle + halfTotalAngle - accumulatedAngle - (charAngle / 2);
			const currentAngleRad: number = currentAngleDeg * Math.PI / 180;

			// Позиционирование по тригонометрическому кругу
			const x = this.labelRadius * Math.cos(currentAngleRad);
			const y = this.labelRadius * Math.sin(currentAngleRad);

			charData.node.setPosition(v3(x, y, 0));

			// Поворот символа перпендикулярно радиусу дуги
			const rotationZ = currentAngleDeg - 90;

			charData.node.setRotationFromEuler(v3(0, 0, rotationZ));

			// Накопливаем угол для следующего символа
			accumulatedAngle += charAngle + this.labelSpacingAngle;
		}
	}
}