// index.js - The entry point for our API Gateway

const express = require('express');
const cors = require('cors');

// Create an instance of the Express application
const app = express();
const PORT = process.env.PORT || 8080; // Use port 8080 by default

// --- Middleware ---
// This enables Cross-Origin Resource Sharing (CORS), so your
// frontend (on Vercel) can communicate with this API.
app.use(cors());

// This allows Express to parse incoming requests with JSON payloads.
app.use(express.json());


// --- Routes ---

// A simple health check endpoint to see if the server is running.
app.get('/', (req, res) => {
    res.send('Dispatch API is running!');
});

// The main endpoint for submitting a repository for analysis.
app.post('/submit', (req, res) => {
    // We expect the request body to contain the repository URL and user ID.
    const { repoUrl, userId } = req.body;

    // Basic validation to ensure we received the URL.
    if (!repoUrl || !userId) {
        return res.status(400).send({ message: 'Missing repoUrl or userId in request body.' });
    }

    console.log(`Received job for user ${userId}: Analyze ${repoUrl}`);

    // In the next step, we will send this data to RabbitMQ.
    // For now, we just send a success response.
    // The status code 202 means "Accepted" - we've accepted the job,
    // but it's not completed yet. This is appropriate for an async system.
    res.status(202).send({ message: 'Job accepted for analysis.', repoUrl: repoUrl });
});


// --- Start the Server ---
// This tells the app to listen for incoming requests on the specified port.
app.listen(PORT, () => {
    console.log(`Dispatch API server listening on port ${PORT}`);
});