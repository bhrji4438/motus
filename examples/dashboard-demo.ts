import fastify from "fastify";
import {
  dashboardPlugin,
  defaultAnalytics,
  defaultAuditLog,
  defaultRealtime,
  defaultDispatchMonitor,
} from "@motus/dashboard";

async function main() {
  const app = fastify({ logger: false });

  // 1. Register the unified operational dashboard plugin
  await app.register(dashboardPlugin);

  // 2. Start the HTTP server on port 4000
  const address = await app.listen({ port: 4000, host: "127.0.0.1" });
  console.log(`Operational Dashboard server listening on ${address}`);
  console.log("Available API routes:");
  console.log(" - GET /api/dashboard/:tenantId/analytics");
  console.log(" - GET /api/dashboard/:tenantId/audit");
  console.log(" - GET /api/dashboard/:tenantId/sessions");
  console.log(" - GET /api/dashboard/:tenantId/realtime/sse");

  // 3. Simulate operational telemetry updates over real-time brokers
  let count = 0;
  setInterval(() => {
    count++;

    // Simulate updating a driver's position in San Francisco
    const lat = 37.7749 + (Math.random() - 0.5) * 0.01;
    const lng = -122.4194 + (Math.random() - 0.5) * 0.01;

    defaultDispatchMonitor.updateDriverLocation("T1", "driver-1", {
      latitude: lat,
      longitude: lng,
    });

    // Push live tracking events over WS and SSE
    defaultRealtime.broadcast("T1", "driver.moved", {
      driverId: "driver-1",
      location: { latitude: lat, longitude: lng },
      status: "ONLINE",
    });

    // Record mock audit action
    if (count % 5 === 0) {
      defaultAuditLog.logAction(
        "T1",
        "system-scheduler",
        "SUPER_ADMIN",
        "heartbeatVerify",
        "driver-1",
        "Verified online driver presence"
      );
      defaultAnalytics.recordSessionStart("T1");
      console.log(
        `[Demo API] Simulated live driver telemetry movement - Broadcast sent (${count})`
      );
    }
  }, 1000);
}

main().catch((err) => {
  console.error("Error starting dashboard demo:", err);
});
