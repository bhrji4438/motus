import {
  Tracer,
  logger,
  CorrelationContext,
  DatabaseInstrumenter,
  EventInstrumenter,
  defaultHealthRegistry,
} from "@motus/observability";

async function main() {
  console.log("Starting Vectro Observability Demo...");

  // 1. Initialize OpenTelemetry Tracing with Console exporter
  Tracer.initialize("vectro-observability-demo", {
    tracesExporter: "console",
    metricsExporter: "console",
  });

  logger.info("Observability tracer system initialized successfully.");

  // 2. Register health check checks for system dependencies
  defaultHealthRegistry.register("redis-telemetry-checker", async () => {
    // Simulate database latency check
    return {
      status: "UP",
      details: { latencyMs: 1.5, nodesActive: 3 },
      timestamp: new Date().toISOString(),
    };
  });

  // 3. Executing code in a transaction Correlation Context
  // This automatically binds correlationId and tenantId to all logs inside the callback scope.
  await CorrelationContext.run(
    { correlationId: "trace-tx-uuid-101", tenantId: "tenant-obs-corp" },
    async () => {
      logger.info("Beginning spatial candidate selection wave...");

      // 4. Trace repository latency calls
      const dbInstrumenter = new DatabaseInstrumenter({
        dbSystem: "redis",
        dbName: "candidate-spatial-index",
      });

      const drivers = await dbInstrumenter.traceCall(
        "queryNearbyCandidates",
        async () => {
          // Simulate latency
          await new Promise((resolve) => setTimeout(resolve, 80));
          return ["driver-alpha", "driver-beta", "driver-gamma"];
        },
        { radiusMeters: 3000, vehicleConstraints: "SEDAN" }
      );

      logger.info(`Matching search completed. Found ${drivers.length} candidates.`);

      // 5. Trace downstream messaging pub/sub publications
      await EventInstrumenter.tracePublish(
        "dispatch.wave.started",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 15));
          logger.info("Wave offer notifications successfully pushed.");
        },
        { sessionId: "session-obs-7", waveNumber: 1 }
      );

      // 6. Running a system diagnostics check
      console.log("Checking diagnostic indicators...");
      const diagnostics = await defaultHealthRegistry.evaluate();
      console.log(`Diagnostics complete. Overall status: ${diagnostics.status}`);
      console.log(`Diagnostic payload: ${JSON.stringify(diagnostics.details, null, 2)}`);
    }
  );
}

main().catch(console.error);
