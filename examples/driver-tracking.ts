import { createVectro, DriverStatus } from "vectro";

async function main() {
  console.log("Initializing Vectro for Driver Tracking Demo...");

  const vectro = await createVectro({
    redis: { host: "localhost", port: 6379 }
  });

  const tenantId = "tenant-tracking-demo";
  const driverId = "driver-courier-404";

  // Subscribe to driver status and location changes
  vectro.events.on("driver.online", (event) => {
    console.log(`[Tracking Event] Driver ${event.payload.driverId} went ONLINE.`);
  });

  vectro.events.on("driver.offline", (event) => {
    console.log(`[Tracking Event] Driver ${event.payload.driverId} went OFFLINE.`);
  });

  try {
    // 1. Onboard a driver
    console.log("Onboarding driver...");
    await vectro.driver.registerDriver({
      tenantId,
      driverId,
      capacity: 2, // Can carry up to 2 concurrent orders
      vehicleType: "MOTORCYCLE",
      idempotencyKey: "reg-courier-404"
    });

    // 2. Set driver online (Starts tracking presence)
    console.log("Setting driver online...");
    await vectro.driver.setDriverOnline(tenantId, driverId);

    // 3. Simulating location heartbeat streams
    console.log("Streaming driver GPS locations...");
    
    // Initial location (registers in spatial index)
    console.log("Heartbeat 1: Starting point (Downtown)...");
    await vectro.driver.updateDriverLocation({
      tenantId,
      driverId,
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 5,
      bearing: 0,
      speed: 0,
      timestamp: new Date().toISOString()
    });

    // Simulate short delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Update 2: Driver moved 5 meters (less than 25m delta, and time < 10s)
    // The TelemetrySampler will discard this point to prevent database bloat, 
    // but the driver's general presence/heartbeat timestamp is still refreshed.
    console.log("Heartbeat 2: Minor movement (5m delta) -> Will be sampled out...");
    await vectro.driver.updateDriverLocation({
      tenantId,
      driverId,
      latitude: 37.77495, // ~5 meters away
      longitude: -122.4194,
      accuracy: 5,
      bearing: 10,
      speed: 15,
      timestamp: new Date().toISOString()
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Update 3: Significant movement (e.g. 50 meters away)
    // This coordinate passes the 25 meters threshold and gets logged in the telemetry database.
    console.log("Heartbeat 3: Large movement (50m delta) -> Logged in telemetry...");
    await vectro.driver.updateDriverLocation({
      tenantId,
      driverId,
      latitude: 37.7754, // ~50+ meters away
      longitude: -122.4190,
      accuracy: 3,
      bearing: 45,
      speed: 30,
      timestamp: new Date().toISOString()
    });

    // 4. Inspecting driver presence profile
    console.log("Fetching driver tracking information...");
    const driverProfile = await vectro.driver.getDriver(tenantId, driverId);
    console.log(`Driver Profile: Status=${driverProfile.status}, Load=${driverProfile.currentLoad}/${driverProfile.capacity}`);
    
    if (driverProfile.lastLocation) {
      console.log(`Last recorded location: ${driverProfile.lastLocation.latitude}, ${driverProfile.lastLocation.longitude}`);
    }

    // 5. Setting driver paused
    console.log("Pausing driver shift...");
    await vectro.driver.setDriverPaused(tenantId, driverId);

    // 6. Set driver offline
    console.log("Signing driver offline...");
    await vectro.driver.setDriverOffline(tenantId, driverId);

  } catch (error) {
    console.error("Driver tracking demo failed:", error);
  } finally {
    await vectro.stop();
  }
}

main().catch(console.error);
