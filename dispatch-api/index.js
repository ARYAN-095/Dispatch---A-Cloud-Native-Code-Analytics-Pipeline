// index.js - The entry point for our API Gateway

const express = require('express');
const cors = require('cors');
const amqp = require('amqplib'); // Import the amqplib library

const app = express();
const PORT = process.env.PORT || 8080;

// --- RabbitMQ Connection Details ---
const RABBITMQ_URL = 'amqp://guest:guest@localhost:5672';
const QUEUE_NAME = 'analysis_jobs';
let channel, connection; // To hold the channel and connection objects

// --- Middleware ---
app.use(cors());
app.use(express.json());

/**
 * Connects to the RabbitMQ server and creates a channel and queue.
 * This function runs once when the server starts.
 */
async function connectToRabbitMQ() {
    try {
        // 1. Establish a connection to the RabbitMQ server
        connection = await amqp.connect(RABBITMQ_URL);
        console.log('Successfully connected to RabbitMQ');

        // 2. Create a channel, which is where most of the API for getting things done resides
        channel = await connection.createChannel();
        console.log('Channel created');

        // 3. Declare a queue for us to send to; this makes sure the queue exists.
        // durable: true means the queue will survive a RabbitMQ server restart.
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        console.log(`Queue '${QUEUE_NAME}' is ready.`);

    } catch (error) {
        console.error('Failed to connect to RabbitMQ:', error);
        // If connection fails, exit the process. In a real app, you'd have a retry mechanism.
        process.exit(1);
    }
}


// --- Routes ---
app.get('/', (req, res) => {
    res.send('Dispatch API is running!');
});

app.post('/submit', async (req, res) => {
    const { repoUrl, userId } = req.body;

    if (!repoUrl || !userId) {
        return res.status(400).send({ message: 'Missing repoUrl or userId in request body.' });
    }

    try {
        // --- Publish to RabbitMQ ---
        const jobPayload = { repoUrl, userId, submittedAt: new Date().toISOString() };
        
        // Convert the JavaScript object to a Buffer to send over the network.
        const messageBuffer = Buffer.from(JSON.stringify(jobPayload));

        // Send the message to our queue.
        // The 'persistent: true' option ensures that the message will be saved to disk
        // and survive a RabbitMQ server restart.
        channel.sendToQueue(QUEUE_NAME, messageBuffer, { persistent: true });

        console.log(`[x] Sent job to queue: ${repoUrl}`);

        res.status(202).send({ message: 'Job accepted for analysis.', repoUrl: repoUrl });

    } catch (error) {
        console.error('Error publishing message to RabbitMQ:', error);
        res.status(500).send({ message: 'Internal server error while queueing job.' });
    }
});


// --- Start the Server ---
// We wrap the server start in our RabbitMQ connection function
// to ensure we don't start accepting requests until we're connected to the queue.
connectToRabbitMQ().then(() => {
    app.listen(PORT, () => {
        console.log(`Dispatch API server listening on port ${PORT}`);
    });
});
