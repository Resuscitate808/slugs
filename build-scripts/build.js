#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { creator } = require('../package.json');
const { builder } = require('../profiles/v2/packages/web-mobile.json');

const CC_VERSION = creator.version;

const args = process.argv.slice(2); 
const isYandex = args.includes('--yandex');
const isVK = args.includes('--vk');

if(isYandex) {
    setEnvironment('YANDEX');
}
else if(isVK) {
    setEnvironment('VK');
}
else{
    setEnvironment('');
}


if (builder.common.name === 'Шаблон') {
    console.error('Укажите название игры в настройках билда');
    return;
}

if (!CC_VERSION) {
    console.error('Поле creator.version не найдено в package.json');
    return;
}

try {
    let CC_PATH = process.platform == "win32" ?
    `C:/ProgramData/cocos/editors/Creator/${CC_VERSION}/CocosCreator.exe ` :
    `/Applications/Cocos/Creator/${CC_VERSION}/CocosCreator.app/Contents/MacOS/CocosCreator `;

    execSync(`${CC_PATH} --project . --build "configPath=./profiles/v2/packages/web-mobile.json"`, { stdio: 'inherit' } );
} catch (error) {
}

const buildIndexPath = path.join(__dirname, '../build/web-mobile/index.html');
if (!fs.existsSync(buildIndexPath)) {
    console.error(`Сборка не удалась: файл ${buildIndexPath} не найден.`);
    process.exit(1);
}

setEnvironment('');

function setEnvironment(key) {
    const settingsPath = "./settings/v2/packages/engine.json";
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));

    if (!Array.isArray(settings.macroCustom)) {
        console.log("В engine.json нет macroCustom — пропускаю переключение макросов.");
        return;
    }

    settings.macroCustom.forEach(element => {
        if (element.key === key) {
            element.value = true;
        }
        else{
            element.value = false;
        }
    });

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2)+"\n");
}

// ==========================================
// БЕЗОПАСНОЕ ДЕКОРИРОВАНИЕ ВЕРСИИ ПОСЛЕ СБОРКИ
// ==========================================
try {
    const packageJsonPath = path.join(__dirname, '../package.json');
    if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const VERSION_FROM_PACKAGE = packageJson.build_version || "1.0.0";

        // Путь к готовому index.html после сборки Cocos Creator
        const indexPath = path.join(__dirname, '../build/web-mobile/index.html');

        if (fs.existsSync(indexPath)) {
            let html = fs.readFileSync(indexPath, 'utf8');

            // Внедряем переменную прямо в браузер игрока/заказчика
            const injectScript = `
<script>
    window.build_version = "${VERSION_FROM_PACKAGE}";
    console.log("%c ВЕРСИЯ БИЛДА: ${VERSION_FROM_PACKAGE} ", "background: #222; color: #00ffcc; font-size: 16px; font-weight: bold; padding: 6px; border: 1px solid #00ffcc;");
</script>
</head>`;

            // Меняем закрывающий тег head на наш скрипт + тег head
            if (html.includes('</head>')) {
                html = html.replace('</head>', injectScript);
                fs.writeFileSync(indexPath, html, 'utf8');
                console.log(`\x1b[32m[Успех] Версия v${VERSION_FROM_PACKAGE} успешно внедрена в билд!\x1b[0m`);
            }
        } else {
            console.log('\x1b[33m[Предупреждение] Файл index.html еще не создан (возможно, это первая сборка или другой путь).\x1b[0m');
        }
    }
} catch (e) {
    console.error('Ошибка записи версии (сборка не сломана):', e);
}