import {
  Tracer,
  logger,
  CorrelationContext,
  DatabaseInstrumenter,
  EventInstrumenter,
  defaultHealthRegistry,
} from "@motus/observability";

async function main() {
  // 1. Initialize OpenTelemetry tracing with Console tracing
  Tracer.initialize("vectro-demo-service", {
    tracesExporter: "console",
    metricsExporter: "console",
  });

  logger.info("Observability System Initialized");

  // 2. Register a mock health check
  defaultHealthRegistry.register("redis-check", async () => {
    return {
      status: "UP",
      details: { latencyMs: 2 },
      timestamp: new Date().toISOString(),
    };
  });

  // 3. Run execution inside a correlation context
  await CorrelationContext.run(
    { correlationId: "demo-trace-12345", tenantId: "T1" },
    async () => {
      logger.info("Starting transaction processing wave");

      // 4. Trace database calls using database instrumenter
      const dbInstrumenter = new DatabaseInstrumenter({
        dbSystem: "redis",
        dbName: "state-store",
      });
      const driverList = await dbInstrumenter.traceCall(
        "getNearbyDrivers",
        async () => {
          // Simulate database fetch delay
          await new Promise((resolve) => setTimeout(resolve, 50));
          return ["driver-1", "driver-2"];
        },
        { radiusMeters: 5000 }
      );

      logger.info(
        `Successfully fetched ${driverList.length} nearby candidates`
      );

      // 5. Trace event publish on the bus
      await EventInstrumenter.tracePublish(
        "session.assigned",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          logger.info("Event dispatched: session.assigned");
        },
        { sessionId: "S100", tenantId: "T1" }
      );

      // 6. Check system and dependency health
      const health = await defaultHealthRegistry.evaluate();
      logger.info(`Diagnostics status: ${health.status}`);
    }
  );
}

main().catch((err) => {
  logger.error("Error during observability demo run", err);
});
