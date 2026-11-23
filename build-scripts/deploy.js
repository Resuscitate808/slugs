#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { config } = require('../package.json');

const TARGET_FOLDER = config.projectId;

// Конфигурационные переменные
let SSH_KEY = path.resolve("../ssh_key");
const REMOTE_USER = "jj-admin";
const REMOTE_HOST = "193.124.65.188";
const LOCAL_SOURCE = path.resolve("./build/web-mobile/");

if (!TARGET_FOLDER) {
    console.error("Ошибка: Не указан id проекта. Укажите config.projectId в package.json.");
    process.exit(1);
}

// Если есть ключ DEPLOY_SSH_KEY значит собираемся в CI/CD нужно сохранить ssh ключ в файл
if (process.env.DEPLOY_SSH_KEY) {
    const key = Buffer.from(process.env.DEPLOY_SSH_KEY, 'base64').toString();
    // создаём временный файл
    const tmpFilePath = path.join(os.tmpdir(), `ssh-key-${Date.now()}`);
    fs.writeFileSync(tmpFilePath, key + '\n', { mode: 0o600 });
    SSH_KEY = tmpFilePath;

    console.log('Using SSH key from CI/CD variable ', tmpFilePath);
}

// Проверка существования SSH ключа
try {
    fs.accessSync(SSH_KEY, fs.constants.R_OK);
} catch (err) {
    console.error(`Ошибка: SSH ключ не найден или недоступен: ${SSH_KEY} Поместите ваш приватный SSH ключ с именем ssh_key в папку на уровень выше проекта`);
    process.exit(1);
}

if(process.platform == "win32"){
    console.log('Проверяю права SSH ключа на Windows...');
    const output = execSync(`icacls "${SSH_KEY}"`).toString();
    
    // Проверяем, есть ли другие пользователи кроме SYSTEM и текущего
    const currentUser = execSync('whoami').toString().trim();
    const lines = output.split('\n');
    let otherUsers = false;

    for (const line of lines) {
        if (line.includes(':\\') && 
            !line.includes('NT AUTHORITY\\SYSTEM') && 
            !line.includes(currentUser)) {
            otherUsers = true;
            break;
        }
    }

    if (otherUsers) {
        console.log('Найдены лишние права доступа, исправляю...');
        execSync(`icacls "${SSH_KEY}" /reset`);
        execSync(`icacls "${SSH_KEY}" /inheritance:r`);
        execSync(`icacls "${SSH_KEY}" /grant:r "${currentUser}:R"`);
        console.log('Права успешно исправлены');
    }
}

// Проверка существования исходной директории
try {
    fs.accessSync(LOCAL_SOURCE, fs.constants.R_OK);
} catch (err) {
    console.error(`Ошибка: Исходная директория не найдена: ${LOCAL_SOURCE}`);
    process.exit(1);
}

try {
    try {
        execSync(
            `ssh -i "${SSH_KEY}" ${REMOTE_USER}@${REMOTE_HOST} ` +
            `"test -d /usr/share/nginx/html/${TARGET_FOLDER}/"`,
            { stdio: 'inherit' }
        );
        console.log(`Удалённая директория /usr/share/nginx/html/${TARGET_FOLDER}/ уже существует.`);
    } catch (e) {
        console.log(`Удалённая директория не найдена. Создаю /usr/share/nginx/html/${TARGET_FOLDER}/...`);
        execSync(
            `ssh -i "${SSH_KEY}" ${REMOTE_USER}@${REMOTE_HOST} ` +
            `"mkdir -p /usr/share/nginx/html/${TARGET_FOLDER}/"`,
            { stdio: 'inherit' }
        );
    }
    
    // Очистка удаленной директории
    console.log(`Очищаем удаленную директорию /usr/share/nginx/html/${TARGET_FOLDER}/...`);
    execSync(
        `ssh -i "${SSH_KEY}" ${REMOTE_USER}@${REMOTE_HOST} ` +
        `"find /usr/share/nginx/html/${TARGET_FOLDER}/ -mindepth 1 -maxdepth 1 -exec rm -rf {} +"`,
        { stdio: 'inherit' }
    );

    // Синхронизация файлов
    console.log(`Копируем файлы из ${LOCAL_SOURCE} на сервер...`);
    if(process.platform == "win32"){
        const files = fs.readdirSync(LOCAL_SOURCE)
            .map(f => `"${path.join(LOCAL_SOURCE, f)}"`)
            .join(' ');

        let cmd = `scp -r -i ${SSH_KEY} `  +
            ` ${files} ` +
            `"${REMOTE_USER}@${REMOTE_HOST}:/usr/share/nginx/html/${TARGET_FOLDER}/"`;
        cmd = cmd.replaceAll("\\", "/");

        execSync(cmd, { stdio: 'inherit', shell: true });
    } else {
        execSync(
            `rsync -av -e "ssh -i ${SSH_KEY}" ` +
            `"${LOCAL_SOURCE}/" ` +
            `${REMOTE_USER}@${REMOTE_HOST}:/usr/share/nginx/html/${TARGET_FOLDER}/`,
            { stdio: 'inherit' }
        );
    }

    console.log("Deploy завершен успешно!");
} catch (error) {
    console.error("Ошибка при выполнении deploy:", error);
    process.exit(1);
}

// Если есть ключ DEPLOY_SSH_KEY значит собираемся в CI/CD нужно удалить за собой временный файл
if (process.env.DEPLOY_SSH_KEY) {
    // Remove the file
    fs.unlink(SSH_KEY, (err) => {
    if (err) {
        console.error(`Error removing file: ${err}`);
        return;
    }

    console.log(`File ${SSH_KEY} has been successfully removed.`);
    });
}