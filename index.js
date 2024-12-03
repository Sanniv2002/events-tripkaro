const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Store rooms and connected clients using a Map
const rooms = new Map();

// WebSocket server connection handler
wss.on("connection", (ws, req) => {
    // Extract tripId from query parameters (e.g., ws://localhost:3000?tripId=123)
    const tripId = new URL(req.url, `http://${req.headers.host}`).searchParams.get("tripId");
    if (!tripId) {
        ws.close(1008, "Missing tripId");
        return;
    }

    // Add client to the corresponding room
    if (!rooms.has(tripId)) {
        rooms.set(tripId, new Set());
    }
    rooms.get(tripId).add(ws);

    console.log(`Client connected to room: ${tripId}`);

    // Handle WebSocket close
    ws.on("close", () => {
        console.log(`Client disconnected from room: ${tripId}`);
        const room = rooms.get(tripId);
        room.delete(ws);
        if (room.size === 0) {
            rooms.delete(tripId); // Remove the room if it's empty
        }
    });

    // Handle errors
    ws.on("error", (error) => {
        console.error(`WebSocket error in room ${tripId}:`, error);
    });
});

// HTTP POST endpoint to send notifications
app.post("/send-notification", (req, res) => {
    const { tripId, message } = req.body;

    if (!tripId || !message) {
        return res.status(400).json({ error: "Missing tripId or message" });
    }

    // Send the notification to all clients in the specified room
    if (rooms.has(tripId)) {
        const room = rooms.get(tripId);
        room.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ tripId, message }));
            }
        });
        console.log(`Notification sent to room ${tripId}: ${message}`);
        res.json({ success: true });
    } else {
        console.log(`No clients connected to room ${tripId}`);
        res.status(404).json({ error: "No clients connected to this tripId" });
    }
});

// Health check route
app.get("/health", (req, res) => {
    const totalRooms = rooms.size;
    const totalConnections = Array.from(rooms.values()).reduce((acc, room) => acc + room.size, 0);

    res.json({
        status: "OK",
        totalRooms,
        totalConnections,
        timestamp: new Date().toISOString(),
    });
});

// Start the server
const PORT = 8000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
