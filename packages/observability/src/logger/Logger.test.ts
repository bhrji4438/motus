import { describe, it, expect, vi } from "vitest";
import { Logger } from "@/logger/Logger.js";
import { CorrelationContext } from "@/logger/CorrelationContext.js";

describe("Logger", () => {
  it("should format logs with active correlation context", () => {
    const logger = new Logger({ level: "debug" });
    const pinoDebugSpy = vi.spyOn((logger as any).pino, "debug");
    const pinoErrorSpy = vi.spyOn((logger as any).pino, "error");

    CorrelationContext.run(
      { correlationId: "log-corr-id", tenantId: "T1" },
      () => {
        logger.debug("Testing debug message");
        expect(pinoDebugSpy).toHaveBeenCalledWith(
          {
            correlationId: "log-corr-id",
            tenantId: "T1",
            sessionId: undefined,
          },
          "Testing debug message"
        );
      }
    );

    const mockError = new Error("Database connection failed");
    logger.error("Testing error message", mockError);
    expect(pinoErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ err: mockError }),
      "Testing error message"
    );
  });
});
