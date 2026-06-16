import { describe, it, expect } from "vitest";
import { TenantGuard } from "@/guards/TenantGuard.js";

describe("TenantGuard", () => {
  describe("validate", () => {
    it("accepts valid tenantId", () => {
      expect(() => TenantGuard.validate("tnt_abc123")).not.toThrow();
    });

    it("throws for empty string", () => {
      expect(() => TenantGuard.validate("")).toThrow("non-empty string");
    });

    it("throws for whitespace-only string", () => {
      expect(() => TenantGuard.validate("   ")).toThrow("non-empty string");
    });

    it("throws for null-like value", () => {
      expect(() => TenantGuard.validate(null as unknown as string)).toThrow();
    });

    it("throws for tenantId containing colon (key injection)", () => {
      expect(() => TenantGuard.validate("tnt:bad")).toThrow(
        "invalid characters"
      );
    });

    it("throws for tenantId containing open brace (hashtag injection)", () => {
      expect(() => TenantGuard.validate("tnt{bad")).toThrow(
        "invalid characters"
      );
    });

    it("throws for tenantId containing close brace", () => {
      expect(() => TenantGuard.validate("tnt}bad")).toThrow(
        "invalid characters"
      );
    });

    it("throws for tenantId containing space", () => {
      expect(() => TenantGuard.validate("tnt bad")).toThrow(
        "invalid characters"
      );
    });
  });

  describe("validateDriverId", () => {
    it("accepts valid driverId", () => {
      expect(() => TenantGuard.validateDriverId("drv_xyz789")).not.toThrow();
    });

    it("throws for empty driverId", () => {
      expect(() => TenantGuard.validateDriverId("")).toThrow(
        "non-empty string"
      );
    });
  });

  describe("validateSessionId", () => {
    it("accepts valid sessionId", () => {
      expect(() => TenantGuard.validateSessionId("ses_abc123")).not.toThrow();
    });

    it("throws for empty sessionId", () => {
      expect(() => TenantGuard.validateSessionId("")).toThrow(
        "non-empty string"
      );
    });
  });
});
