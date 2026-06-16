import { createVectro, MatchingStrategy, SessionState } from "vectro";

async function main() {
  console.log("Initializing Vectro for Dispatching Workflow Demo...");

  const vectro = await createVectro({
    redis: { host: "localhost", port: 6379 }
  });

  const tenantId = "tenant-dispatch-demo";
  const driverId = "driver-courier-77";
  const sessionId = "session-ride-77";

  // Wire up event loggers
  vectro.events.on("dispatch.wave.started", (event) => {
    const payload = event.payload as any;
    console.log(`[Dispatch Event] Wave ${payload.waveNumber} started! Locked Candidates: ${payload.candidates.join(", ")}`);
  });

  vectro.events.on("session.assigned", (event) => {
    console.log(`[Dispatch Event] Session assigned to driver: ${event.payload.assignedDriverId}`);
  });

  vectro.events.on("session.completed", (event) => {
    console.log(`[Dispatch Event] Session completed! Summary report is ready.`);
  });

  try {
    // 1. Register Tenant
    console.log("Setting up tenant configuration...");
    await vectro.tenant.registerTenant({
      tenantId,
      name: "Downtown Courier Service",
      matchingStrategy: MatchingStrategy.DISTANCE,
      geofences: [
        {
          name: "City Center",
          boundary: [
            { latitude: 37.7700, longitude: -122.4200 },
            { latitude: 37.7800, longitude: -122.4200 },
            { latitude: 37.7800, longitude: -122.4100 },
            { latitude: 37.7700, longitude: -122.4100 }
          ]
        }
      ]
    });

    // 2. Onboard and set driver online
    console.log("Onboarding driver...");
    await vectro.driver.registerDriver({
      tenantId,
      driverId,
      capacity: 1,
      vehicleType: "CAR"
    });
    await vectro.driver.setDriverOnline(tenantId, driverId);

    // Place driver location inside City Center geofence
    await vectro.driver.updateDriverLocation({
      tenantId,
      driverId,
      latitude: 37.7750,
      longitude: -122.4150,
      timestamp: new Date().toISOString()
    });

    // 3. Create a session matching request
    console.log("Customer requests a ride: Spawning dispatch session...");
    await vectro.session.createSession({
      tenantId,
      sessionId,
      pickup: { latitude: 37.7755, longitude: -122.4160 },
      destination: { latitude: 37.7880, longitude: -122.4010 },
      requiredVehicleType: "CAR"
    });

    // Pause briefly to let the matching pipeline assign locks
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. Driver accepts the offer in Wave 1
    console.log("Driver submits acceptance command...");
    await vectro.driver.acceptSessionOffer(tenantId, driverId, sessionId, 1);

    // Wait a brief moment for locks to transition session status
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 5. Simulating ride en route to pickup
    console.log("Driver starting journey to pickup...");
    await vectro.driver.updateDriverLocation({
      tenantId,
      driverId,
      latitude: 37.7753,
      longitude: -122.4158,
      timestamp: new Date().toISOString()
    });

    // 6. Driver arrived at pickup
    console.log("Driver arrived at pickup location...");
    // Let's check status
    let session = await vectro.query.getSession(tenantId, sessionId);
    console.log(`Session state: ${session.status}, Assigned Driver: ${session.assignedDriverId}`);

    // 7. Complete the trip
    console.log("Completing the trip...");
    await vectro.session.completeSession({
      tenantId,
      sessionId
    });

    // 8. Fetch the final route report
    console.log("Fetching final route report...");
    const report = await vectro.query.getSessionReport(tenantId, sessionId);
    console.log(`Trip Summary: Path contains ${report.points.length} sampled points. Encoded Polyline: "${report.polyline}"`);

  } catch (error) {
    console.error("Dispatching demo failed:", error);
  } finally {
    await vectro.stop();
  }
}

main().catch(console.error);
