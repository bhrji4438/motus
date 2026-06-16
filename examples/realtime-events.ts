import { createVectro } from "vectro";

async function main() {
  console.log("Initializing Vectro for Real-Time Events Demo...");

  const vectro = await createVectro({
    redis: { host: "localhost", port: 6379 }
  });

  const tenantId = "tenant-events-demo";

  // 1. Listening to driver registry & shifts
  vectro.events.on("driver.registered", (event) => {
    console.log(`[Event Service] NEW DRIVER REGISTERED - ID: ${event.payload.driverId}, Type: ${event.payload.vehicleType}`);
  });

  vectro.events.on("driver.online", (event) => {
    console.log(`[Event Service] DRIVER ONLINE - ID: ${event.payload.driverId}`);
  });

  // 2. Listening to dispatch wave offer updates
  vectro.events.on("dispatch.wave.started", (event) => {
    const payload = event.payload as any;
    console.log(`[Event Service] WAVE START - Session: ${payload.sessionId}, Wave: #${payload.waveNumber}, Candidates: ${payload.candidates.join(", ")}`);
  });

  // 3. Listening to session state transitions
  vectro.events.on("session.created", (event) => {
    console.log(`[Event Service] SESSION CREATED - ID: ${event.payload.sessionId}`);
  });

  vectro.events.on("session.assigned", (event) => {
    console.log(`[Event Service] SESSION ASSIGNED - ID: ${event.payload.sessionId}, Assigned Driver: ${event.payload.assignedDriverId}`);
  });

  vectro.events.on("session.completed", (event) => {
    console.log(`[Event Service] SESSION COMPLETED - ID: ${event.payload.sessionId}`);
  });

  vectro.events.on("session.cancelled", (event) => {
    console.log(`[Event Service] SESSION CANCELLED - ID: ${event.payload.sessionId}, Reason: ${event.payload.reason}`);
  });

  // 4. Wildcard event listener for auditing
  vectro.events.on("*", (event) => {
    console.log(`[Audit Logger] Telemetry Event logged: ${event.eventName} (Tenant: ${event.tenantId}, EventID: ${event.eventId})`);
  });

  console.log("Event listeners bound. Ready to capture domain updates.");

  try {
    // Perform quick mock actions to trigger events
    const driverId = `drv_worker_${Math.floor(Math.random() * 1000)}`;
    const sessionId = `ses_job_${Math.floor(Math.random() * 1000)}`;

    // Set up tenant
    await vectro.tenant.registerTenant({ tenantId, name: "Events Demo Corp" });
    
    // Register & set online
    await vectro.driver.registerDriver({ tenantId, driverId, capacity: 1, vehicleType: "BICYCLE" });
    await vectro.driver.setDriverOnline(tenantId, driverId);

    // Update location
    await vectro.driver.updateDriverLocation({
      tenantId,
      driverId,
      latitude: 40.7128,
      longitude: -74.0060,
      timestamp: new Date().toISOString()
    });

    // Create session
    await vectro.session.createSession({
      tenantId,
      sessionId,
      pickup: { latitude: 40.7130, longitude: -74.0062 },
      destination: { latitude: 40.7200, longitude: -74.0100 },
      requiredVehicleType: "BICYCLE"
    });

    // Let the matching workers assign the trip
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Driver accepts
    await vectro.driver.acceptSessionOffer(tenantId, driverId, sessionId, 1);

    // Complete session
    await vectro.session.completeSession({ tenantId, sessionId });

    // Wait a brief moment to catch trailing logs
    await new Promise((resolve) => setTimeout(resolve, 500));

  } catch (error) {
    console.error("Mock pipeline failed:", error);
  } finally {
    await vectro.stop();
  }
}

main().catch(console.error);
