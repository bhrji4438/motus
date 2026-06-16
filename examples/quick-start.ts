import { createVectro, MatchingStrategy } from "vectro";

async function main() {
  console.log("Starting Vectro Quick Start...");

  // 1. Initialize the Vectro engine
  const vectro = await createVectro({
    redis: {
      host: "localhost",
      port: 6379,
    },
    socketio: {
      port: 3000,
    },
  });

  const tenantId = "tenant-quickstart";
  const driverId = "driver-john";
  const sessionId = "session-ride-101";

  // 2. Listen for real-time events
  vectro.events.on("session.created", (event) => {
    console.log(`[Event] Session created: ${event.payload.sessionId}`);
  });

  vectro.events.on("session.assigned", (event) => {
    console.log(`[Event] Session assigned to Driver: ${event.payload.assignedDriverId}`);
  });

  try {
    // 3. Register a Tenant
    console.log("Registering tenant...");
    await vectro.tenant.registerTenant({
      tenantId,
      name: "Quickstart Delivery Service",
      matchingStrategy: MatchingStrategy.DISTANCE,
      geofences: [
        {
          name: "Downtown Zone",
          boundary: [
            { latitude: 40.7128, longitude: -74.006 },
            { latitude: 40.7200, longitude: -74.006 },
            { latitude: 40.7200, longitude: -73.990 },
            { latitude: 40.7128, longitude: -73.990 },
          ],
        },
      ],
      idempotencyKey: "tnt_quickstart_key",
    });

    // 4. Register a Driver
    console.log("Registering driver...");
    await vectro.driver.registerDriver({
      tenantId,
      driverId,
      capacity: 1,
      vehicleType: "SEDAN",
      idempotencyKey: "drv_john_key",
    });

    // 5. Set Driver Online and update their location within the geofence
    console.log("Setting driver online...");
    await vectro.driver.setDriverOnline(tenantId, driverId);

    console.log("Updating driver location...");
    await vectro.driver.updateDriverLocation({
      tenantId,
      driverId,
      latitude: 40.7135,
      longitude: -74.0010,
      timestamp: new Date().toISOString(),
    });

    // 6. Create a Dispatch Session (triggers matching engine and wave offers)
    console.log("Creating dispatch session...");
    await vectro.session.createSession({
      tenantId,
      sessionId,
      pickup: { latitude: 40.7130, longitude: -74.0020 },
      destination: { latitude: 40.7306, longitude: -73.9352 },
      requiredVehicleType: "SEDAN",
      idempotencyKey: "ses_ride_key",
    });

    // Wait 2 seconds for the matching flow and wave offers to fire
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 7. Driver accepts the offer
    console.log("Driver accepting dispatch offer...");
    await vectro.driver.acceptSessionOffer(tenantId, driverId, sessionId, 1);

    // Wait a moment to observe events
    await new Promise((resolve) => setTimeout(resolve, 1000));

  } catch (error) {
    console.error("Quick Start workflow failed:", error);
  } finally {
    // 8. Shut down gracefully
    console.log("Stopping Vectro engine...");
    await vectro.stop();
  }
}

main().catch(console.error);
