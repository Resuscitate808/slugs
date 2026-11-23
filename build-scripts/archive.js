#!/usr/bin/env node
const { execSync } = require('child_process');
const { config } = require('../package.json');

const ARCHIVE_NAME = config.projectId;

if (!ARCHIVE_NAME) {
    console.error("Ошибка: Не указан id проекта. Укажите config.projectId в package.json.");
    process.exit(1);
}

if(process.platform == "win32"){
    console.error("Деплой не поддерживается на Windows. Пожалуйста, используйте macOS или Linux.");
}else{

    execSync(
                `cd ./build/web-mobile && zip -r ${ARCHIVE_NAME}.zip . -x '**/__MACOSX'`,
                { stdio: 'inherit' }
            );
}

