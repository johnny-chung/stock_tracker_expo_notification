// Entry point: connect to MongoDB and start change stream watchers
import "dotenv/config";
import http from "http";
import { connectMongo, disconnectMongo, getDb } from "./services/mongo.js";
import { startWatchers, stopWatchers } from "./watchers/changeStream.js";

let streams = [];
let server;
const HEALTH_PORT = process.env.HEALTH_PORT
  ? Number(process.env.HEALTH_PORT)
  : 3099;

function startHealthServer() {
  server = http.createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url && req.url.startsWith("/healthz")) {
        // Basic health details: uptime, mongo ping status, watcher count
        let mongoOk = false;
        try {
          const db = getDb();
          // Attempt a lightweight ping
          await db.command({ ping: 1 });
          mongoOk = true;
        } catch (e) {
          mongoOk = false;
        }

        const body = JSON.stringify({
          status: mongoOk ? "ok" : "degraded",
          uptime: process.uptime(),
          mongo: { connected: mongoOk },
          watchers: { count: streams?.length || 0 },
        });
        res.writeHead(mongoOk ? 200 : 503, {
          "Content-Type": "application/json",
        });
        res.end(body);
        return;
      }
      // Not found for other routes
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  });

  server.listen(HEALTH_PORT, () => {
    console.log(`[health] Listening on port ${HEALTH_PORT} for /healthz`);
  });
}

async function main() {
  if (!process.env.EXPO_PUSH_TOKEN) {
    console.error(
      "Missing EXPO_PUSH_TOKEN. Set it to your device token, e.g. ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
    );
    process.exit(1);
  }
  await connectMongo();
  streams = await startWatchers();
  console.log("Change stream watchers started. Service is running...");
  // Start a minimal HTTP health server for Kubernetes probes
  startHealthServer();
}

main().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});

// Graceful shutdown
async function shutdown(signal) {
  try {
    console.log(`\nReceived ${signal}, shutting down...`);
    await stopWatchers(streams);
    await disconnectMongo();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log("[health] Server closed");
    }
    process.exit(0);
  } catch (e) {
    console.error("Error during shutdown:", e);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
