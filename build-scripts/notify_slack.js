const { config } = require('../package.json');
const { builder } = require('../profiles/v2/packages/web-mobile.json');
const { execSync } = require('child_process');

const project_name = builder.common.name;
//const author = process.env.GITLAB_USER_NAME || process.env.GITLAB_USER_LOGIN || "";

// Получаем хэш предыдущего успешного коммита
const previousCommitHash = process.env.CI_COMMIT_BEFORE_SHA ||
    process.env.CI_MERGE_REQUEST_TARGET_BRANCH_SHA ||
    'HEAD~1';

async function sendSlackMessage() {
    try {
        // Получаем все коммиты от предыдущего до текущего
        const gitCommand = `git log --pretty=format:"%s (%an)" ${previousCommitHash}..HEAD`;
        const commits = execSync(gitCommand, { encoding: 'utf8' }).trim();

        let commitMessages;
        if (commits) {
            commitMessages = commits.split('\n').map(commit => `• ${commit}`).join('\n');
        } else {
            commitMessages = "• Нет новых коммитов или невозможно определить предыдущую сборку";
        }

        const externalUrl = process.env.EXTERNAL_URL || "https://dev.jayjoy.games/" + config.projectId;

        const payload = {
            blocks: [
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*${project_name}*\n\n*Обновление:*\n${commitMessages}\n\n*Ссылка на игру:*\n<${externalUrl}|${externalUrl}>`
                    }
                }
            ],
            unfurl_links: true,
            unfurl_media: true
        };

        // Отправляем в Slack
        const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log('Message sent successfully');

    } catch (error) {
        console.error('Error getting git history:', error);
        await sendFallbackMessage();
    }
}

async function sendFallbackMessage() {
    try {
        const currentCommit = process.env.CI_COMMIT_MESSAGE || "";
        const escCommit = currentCommit.replace(/\r?\n/g, "\n");
        const externalUrl = process.env.EXTERNAL_URL || "https://dev.jayjoy.games/" + config.projectId;

        const payload = {
            blocks: [
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*${project_name}*\n${escCommit}\n<${externalUrl}|${externalUrl}>`
                    }
                }
            ],
            unfurl_links: true,
            unfurl_media: true
        };

        const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log('Fallback message sent successfully');
    } catch (fetchError) {
        console.error('Error sending fallback message:', fetchError);
        process.exit(1);
    }
}

// Запускаем основную функцию
sendSlackMessage();