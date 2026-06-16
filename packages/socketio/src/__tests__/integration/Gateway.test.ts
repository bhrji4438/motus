import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { io as clientIo, Socket as ClientSocket } from "socket.io-client";
import { SocketServer } from "@/server/SocketServer.js";
import { IAuthenticator } from "@/auth/IAuthenticator.js";
import { DriverNamespace } from "@motus/types";

describe("Gateway Integration Tests", () => {
  let server: SocketServer;
  const port = 9081;

  // Mock Dependencies
  const mockAuthenticator: IAuthenticator = {
    authenticate: async (handshake) => {
      const authHeader = handshake.token;
      if (authHeader === "fail-token") {
        throw new Error("Invalid authentication token");
      }
      if (authHeader === "driver-token") {
        return {
          tenantId: "tnt_1",
          driverId: "drv_1",
          userId: "usr_drv",
        };
      }
      return {
        tenantId: "tnt_1",
        userId: "usr_1",
      };
    },
  };

  const mockDriverNamespace = {
    setDriverOnline: vi.fn().mockResolvedValue(undefined),
    setDriverOffline: vi.fn().mockResolvedValue(undefined),
    setDriverPaused: vi.fn().mockResolvedValue(undefined),
    updateDriverLocation: vi.fn().mockResolvedValue(undefined),
    acceptSessionOffer: vi.fn().mockResolvedValue(undefined),
    rejectSessionOffer: vi.fn().mockResolvedValue(undefined),
  };

  const mockEventBus = {
    on: vi.fn(),
    publish: vi.fn(),
  };

  beforeAll(async () => {
    server = new SocketServer(
      {
        port,
        limits: { maxRoomsPerSocket: 10, maxSubscriptionsPerSocket: 10 },
      },
      mockAuthenticator,
      mockDriverNamespace as unknown as DriverNamespace,
      mockEventBus
    );
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  const connectClient = (
    token: string,
    tenantId = "tnt_1"
  ): Promise<ClientSocket> => {
    return new Promise((resolve, reject) => {
      const client = clientIo(`http://localhost:${port}`, {
        auth: { token, tenantId },
        query: { tenantId },
        transports: ["websocket"],
      });
      client.on("connect", () => resolve(client));
      client.on("connect_error", (err) => reject(err));
    });
  };

  it("rejects unauthorized handshakes", async () => {
    await expect(connectClient("fail-token")).rejects.toThrow();
  });

  it("rejects handshake if tenantId is missing", async () => {
    await expect(
      new Promise((resolve, reject) => {
        const client = clientIo(`http://localhost:${port}`, {
          auth: { token: "valid-token" }, // No tenantId
          transports: ["websocket"],
        });
        client.on("connect", () => {
          client.disconnect();
          resolve(true);
        });
        client.on("connect_error", (err) => reject(err));
      })
    ).rejects.toThrow();
  });

  it("allows client connection and joins tenant room", async () => {
    const client = await connectClient("valid-token");
    expect(client.connected).toBe(true);

    const sockets = await server.io.fetchSockets();
    expect(sockets.length).toBe(1);
    expect(sockets[0].data.auth.tenantId).toBe("tnt_1");

    client.disconnect();
  });

  it("implements DriverGateway inbound actions", async () => {
    const client = await connectClient("driver-token");

    // Test driver:presence ONLINE
    client.emit("driver:presence", { status: "ONLINE" });
    await new Promise((r) => setTimeout(r, 100));
    expect(mockDriverNamespace.setDriverOnline).toHaveBeenCalledWith(
      "tnt_1",
      "drv_1"
    );

    // Test driver:location stream
    client.emit("driver:location", {
      location: { latitude: 37.7749, longitude: -122.4194 },
      speed: 15,
      bearing: 180,
    });
    await new Promise((r) => setTimeout(r, 100));
    expect(mockDriverNamespace.updateDriverLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tnt_1",
        driverId: "drv_1",
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 15,
        bearing: 180,
      })
    );

    // Test assignment:accept
    client.emit("assignment:accept", { sessionId: "ses_123", waveNumber: 1 });
    await new Promise((r) => setTimeout(r, 100));
    expect(mockDriverNamespace.acceptSessionOffer).toHaveBeenCalledWith(
      "tnt_1",
      "drv_1",
      "ses_123",
      1
    );

    client.disconnect();
  });

  it("streams Session events through local room bridge", async () => {
    const client = await connectClient("valid-token");

    // Subscribe to session
    client.emit("session:subscribe", { sessionId: "ses_abc" });
    await new Promise((r) => setTimeout(r, 100));

    // Simulate core session.assigned event publish
    let receivedPayload: any = null;
    client.on("session:assigned", (payload) => {
      receivedPayload = payload;
    });

    server.routeBusEvent({
      eventId: "evt_1",
      eventName: "session.assigned",
      timestamp: new Date().toISOString(),
      governance: {
        producer: "DispatchEngine",
        consumers: ["SocketServer"],
        deliveryGuarantee: "AT_LEAST_ONCE",
        orderingScope: "SESSION",
        partitionKey: "sessionId",
        idempotencyRequirements: "None",
        version: "1.0.0",
      },
      tenantId: "tnt_1",
      payload: {
        tenantId: "tnt_1",
        sessionId: "ses_abc",
        assignedDriverId: "drv_1",
        estimatedDurationSeconds: 600,
      },
    });

    await new Promise((r) => setTimeout(r, 100));
    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload.assignedDriverId).toBe("drv_1");

    client.disconnect();
  });

  it("applies tracking optimizations (decimation and rate-limiting)", async () => {
    const client = await connectClient("valid-token");

    // Subscribe to tracking
    client.emit("tracking:subscribe", { sessionId: "ses_opt" });
    await new Promise((r) => setTimeout(r, 100));

    let updateCount = 0;
    client.on("tracking:update", () => {
      updateCount++;
    });

    // We instantiate a TrackingGateway with customized throttling parameters for this test:
    // 50ms intervals, 1.0m decimation to test rapidly.
    const customTrackingGateway = new (server.trackingGateway
      .constructor as any)(
      server.transport,
      server.roomManager,
      server.eventRouter,
      1.0, // 1m decimation
      50, // 50ms temporal throttle
      2000 // force interval
    );

    // 1st location: should broadcast
    const success1 = customTrackingGateway.broadcastTrackingUpdate("ses_opt", {
      location: { latitude: 37.7749, longitude: -122.4194 },
      timestamp: new Date().toISOString(),
    });
    expect(success1).toBe(true);

    // 2nd location: immediately (less than 50ms): should be throttled temporal-wise
    const success2 = customTrackingGateway.broadcastTrackingUpdate("ses_opt", {
      location: { latitude: 37.775, longitude: -122.4195 },
      timestamp: new Date().toISOString(),
    });
    expect(success2).toBe(false);

    // Wait 60ms
    await new Promise((r) => setTimeout(r, 60));

    // 3rd location: moved < 1 meter (specifically ~0.14m): should be dropped spatial-wise
    const success3 = customTrackingGateway.broadcastTrackingUpdate("ses_opt", {
      location: { latitude: 37.774901, longitude: -122.419401 },
      timestamp: new Date().toISOString(),
    });
    expect(success3).toBe(false);

    // 4th location: moved > 2 meters: should broadcast
    const success4 = customTrackingGateway.broadcastTrackingUpdate("ses_opt", {
      location: { latitude: 37.776, longitude: -122.42 },
      timestamp: new Date().toISOString(),
    });
    expect(success4).toBe(true);

    await new Promise((r) => setTimeout(r, 100));
    expect(updateCount).toBe(2);

    client.disconnect();
  });
});
