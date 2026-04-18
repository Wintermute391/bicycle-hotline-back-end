import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { connectToMongo } from "./shared/mongo.js";
import { registerCrmSocketHandlers } from "./crm/socket.js";

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));
app.options("*", cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, db: "connected" }));

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  console.log("[server] client connected", { id: socket.id });
  registerCrmSocketHandlers(io, socket);

  socket.on("disconnect", (reason) => {
    console.log("[server] client disconnected", { id: socket.id, reason });
  });
});

async function start() {
  await connectToMongo();
  httpServer.listen(PORT, () => {
    console.log(`[server] listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("[server] startup error", err);
  process.exit(1);
});
