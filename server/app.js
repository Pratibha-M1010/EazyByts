const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Connect DB
require('./db/connection');

// Import Files
const Users = require('./models/Users');
const Conversations = require('./models/Conversations');
const Messages = require('./models/Messages');

// app Setup
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

const port = process.env.PORT || 8000;

// Routes
app.get('/', (req, res) => {
    res.send('Welcome');
});

// User Registration
app.post('/api/register', async (req, res) => {
    try {
        const { fullName, email, password } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).send('Please fill all required fields');
        }

        const isAlreadyExist = await Users.findOne({ email });
        if (isAlreadyExist) {
            return res.status(400).send('User already exists');
        }

        const newUser = new Users({ fullName, email });
        const hashedPassword = await bcryptjs.hash(password, 10);
        newUser.password = hashedPassword;
        await newUser.save();
        return res.status(200).send('User registered successfully');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// User Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).send('Please fill all required fields');
        }

        const user = await Users.findOne({ email });
        if (!user) {
            return res.status(400).send('User email or password is incorrect');
        }

        const isPasswordValid = await bcryptjs.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).send('User email or password is incorrect');
        }

        const payload = { userId: user._id, email: user.email };
        const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';
        const token = jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: '24h' });

        await Users.updateOne({ _id: user._id }, { $set: { token } });
        res.status(200).json({
            user: { id: user._id, email: user.email, fullName: user.fullName },
            token,
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Create a Conversation
app.post('/api/conversation', async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        if (!senderId || !receiverId) {
            return res.status(400).send('Please provide both senderId and receiverId');
        }

        const newConversation = new Conversations({ members: [senderId, receiverId] });
        await newConversation.save();
        res.status(200).send('Conversation created successfully');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Get User Conversations
app.get('/api/conversations/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const conversations = await Conversations.find({ members: { $in: [userId] } });
        
        const conversationUserData = await Promise.all(conversations.map(async (conversation) => {
            const receiverId = conversation.members.find(member => member !== userId);
            const user = await Users.findById(receiverId);
            return {
                user: { receiverId: user._id, email: user.email, fullName: user.fullName },
                conversationId: conversation._id,
            };
        }));
        
        res.status(200).json(conversationUserData);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Send a Message
app.post('/api/message', async (req, res) => {
    try {
        const { conversationId, senderId, message, receiverId } = req.body;
        if (!senderId || !message || !conversationId) {
            return res.status(400).send('Please provide all required fields');
        }

        const newMessage = new Messages({ conversationId, senderId, message });
        await newMessage.save();
        res.status(200).send('Message sent successfully');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Get Messages for a Conversation
app.get('/api/message/:conversationId', async (req, res) => {
    try {
        const conversationId = req.params.conversationId;
        if (conversationId === 'new') {
            const { senderId, receiverId } = req.query;
            const existingConversation = await Conversations.find({ members: { $all: [senderId, receiverId] } });
            if (existingConversation.length > 0) {
                return res.status(200).json(await getMessages(existingConversation[0]._id));
            }
            return res.status(200).json([]);
        }
        res.status(200).json(await getMessages(conversationId));
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Helper Function to Get Messages
const getMessages = async (conversationId) => {
    const messages = await Messages.find({ conversationId });
    return Promise.all(messages.map(async (message) => {
        const user = await Users.findById(message.senderId);
        return {
            user: { id: user._id, email: user.email, fullName: user.fullName },
            message: message.message,
        };
    }));
};

// Get All Users Except Current User
app.get('/api/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const users = await Users.find({ _id: { $ne: userId } });
        const usersData = users.map(user => ({
            user: { email: user.email, fullName: user.fullName, receiverId: user._id }
        }));
        res.status(200).json(usersData);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
