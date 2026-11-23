"use strict";
const { spawn } = require('child_process');
Object.defineProperty(exports, "__esModule", { value: true });
exports.unload = exports.load = exports.methods = void 0;
/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
exports.methods = {
    /**
     * @en A method that can be triggered by message
     * @zh 通过 message 触发的方法
     */
    build_dev() {
        Editor.Panel.open('console');
        runCmd('build-dev');
    },
    deploy_dev() {
        Editor.Panel.open('console');
        runCmd('deploy-dev');
    },
    build_deploy_dev() {
        Editor.Panel.open('console');
        runCmd('build-deploy-dev');
    },
    build_yandex() {
        Editor.Panel.open('console');
        runCmd('build-yandex');
    },
    build_archive_yandex() {
        Editor.Panel.open('console');
        runCmd('build-archive-yandex');
    },
    build_vk() {
        Editor.Panel.open('console');
        runCmd('build-vk');
    }
};
/**
 * @en Method Triggered on Extension Startup
 * @zh 扩展启动时触发的方法
 */
function load() { }
exports.load = load;
/**
 * @en Method Triggered on Extension Uninstallation
 * @zh 卸载扩展时触发的方法
 */
function unload() { }
exports.unload = unload;

function runCmd(cmd){

    console.log(`Run ` + cmd);
    // Получаем путь к корню проекта Cocos Creator
    const projectPath = Editor.Project.path;

    const deployProcess = spawn('npm', ['run', cmd], {
        cwd: projectPath,
        shell: true, // Для Windows важно использовать shell
    });

    // Вывод в реальном времени из stdout (обычные сообщения)
    deployProcess.stdout.on('data', (data) => {
        console.log(`[` + cmd + `] ${data.toString().trim()}`);
    });

    // Вывод в реальном времени из stderr (ошибки/предупреждения)
    deployProcess.stderr.on('data', (data) => {
        console.error(`[` + cmd + ` ERROR] ${data.toString().trim()}`);
    });

    // Обработка завершения процесса
    deployProcess.on('close', (code) => {
        if (code === 0) {
            console.log('[` + cmd + `] ✅ Завершён успешно');
        } else {
            console.error(`[` + cmd + `] ❌ Завершён с кодом ${code}`);
        }
    });
}
