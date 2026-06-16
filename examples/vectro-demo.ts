import { createVectro, MatchingStrategy } from "vectro";

async function main() {
  console.log("Initializing Vectro SDK platform...");

  // 1. Initialize Vectro. If no Redis options are passed, it automatically resolves
  // from REDIS_HOST, REDIS_PORT, REDIS_PASSWORD env vars, defaulting to localhost:6379.
  // We also configure it to boot a Socket.IO real-time server on port 3000.
  const vectro = await createVectro({
    redis: {
      host: "localhost",
      port: 6379,
    },
    socketio: {
      port: 3000,
    },
  });

  console.log("Vectro platform initialized and running!");

  const suffix = Math.floor(Math.random() * 1000000);
  const tenantId = `tnt_global_${suffix}`;
  const driverId = `drv_john_doe_${suffix}`;
  const sessionId = `ses_ride_${suffix}`;

  // 2. Subscribe to real-time driver online and session events
  vectro.events.on("driver.online", (event) => {
    console.log(`[Event Subscriber] Driver online! Driver ID: ${event.payload.driverId}`);
  });

  vectro.events.on("session.created", (event) => {
    console.log(`[Event Subscriber] Session created! Session ID: ${event.payload.sessionId}`);
  });

  vectro.events.on("session.assigned", (event) => {
    console.log(
      `[Event Subscriber] Session assigned! Session ID: ${event.payload.sessionId}, Driver ID: ${event.payload.assignedDriverId}`
    );
  });

  try {
    // 3. Register a Tenant workspace with geofences and matching rules
    console.log("Registering tenant...");
    await vectro.tenant.registerTenant({
      tenantId,
      name: "Global Logistics Inc",
      matchingStrategy: MatchingStrategy.DISTANCE,
      geofences: [
        {
          name: "Downtown Zone",
          boundary: [
            { latitude: 40.7128, longitude: -74.006 },
            { latitude: 40.72, longitude: -74.006 },
            { latitude: 40.72, longitude: -73.99 },
            { latitude: 40.7128, longitude: -73.99 },
          ],
        },
      ],
      idempotencyKey: "t1",
    });

    // 4. Onboard and activate a Driver
    console.log("Registering driver...");
    await vectro.driver.registerDriver({
      tenantId,
      driverId,
      capacity: 1,
      vehicleType: "SEDAN",
      idempotencyKey: "d1",
    });

    console.log("Setting driver online and updating location...");
    await vectro.driver.setDriverOnline(tenantId, driverId);

    // Update driver coordinates inside the Downtown geofence
    await vectro.driver.updateDriverLocation({
      tenantId,
      driverId,
      latitude: 40.7135,
      longitude: -74.001,
      timestamp: new Date().toISOString(),
    });

    // 5. Create a Dispatch and Tracking Session
    console.log("Creating dispatch session...");
    await vectro.session.createSession({
      tenantId,
      sessionId,
      pickup: { latitude: 40.713, longitude: -74.002 },
      destination: { latitude: 40.7306, longitude: -73.9352 },
      requiredVehicleType: "SEDAN",
      idempotencyKey: "s1",
    });

    // Wait a brief moment to allow matching and event routing loops to execute
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 6. Driver accepts the offer
    console.log("Driver accepting trip offer...");
    await vectro.driver.acceptSessionOffer(tenantId, driverId, sessionId, 1);

    // 7. Cancel the session (valid from DRIVER_ASSIGNED state)
    console.log("Cancelling session...");
    await vectro.session.cancelSession({
      tenantId,
      sessionId,
      reason: "Passenger changed plans",
      idempotencyKey: "c1",
    });

    // Set driver back offline
    await vectro.driver.setDriverOffline(tenantId, driverId);

  } catch (err) {
    console.error("Vectro workflow failed:", err);
  } finally {
    // 7. Gracefully shutdown all background loops, cleanup servers, and Redis client
    console.log("Gracefully stopping Vectro SDK platform...");
    await vectro.stop();
    console.log("Vectro platform stopped successfully.");
  }
}

main().catch(console.error);
