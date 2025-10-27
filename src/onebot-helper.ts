import { Bot, Session } from 'koishi';

export function createBotTextMsgNode(bot: Bot, content: string) {
    return {
        type: 'node',
        data: {
            user_id: bot.user.id,
            nickname: bot.user.nick,
            content: content,
        },
    };
}
