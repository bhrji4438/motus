import { describe, it, expect } from 'vitest';
import { KeyFactory } from '@/keys/KeyFactory.js';

describe('KeyFactory', () => {
  const tenantId = 'tnt_abc123';
  const driverId = 'drv_xyz789';
  const sessionId = 'ses_def456';

  describe('Tenant keys', () => {
    it('generates tenantHash with correct format', () => {
      const key = KeyFactory.tenantHash(tenantId);
      expect(key).toBe(`tenant:{${tenantId}}:config`);
    });
  });

  describe('Driver keys', () => {
    it('generates driverHash with correct format', () => {
      const key = KeyFactory.driverHash(tenantId, driverId);
      expect(key).toBe(`tenant:{${tenantId}}:driver:${driverId}`);
    });

    it('generates driverGeoIndex with correct format', () => {
      const key = KeyFactory.driverGeoIndex(tenantId);
      expect(key).toBe(`tenant:{${tenantId}}:drivers:geo`);
    });

    it('generates driverPresenceZset with correct format', () => {
      const key = KeyFactory.driverPresenceZset(tenantId);
      expect(key).toBe(`tenant:{${tenantId}}:presence:active`);
    });
  });

  describe('Session keys', () => {
    it('generates sessionHash with correct format', () => {
      const key = KeyFactory.sessionHash(tenantId, sessionId);
      expect(key).toBe(`tenant:{${tenantId}}:session:${sessionId}`);
    });

    it('generates sessionTelemetryStream with correct format', () => {
      const key = KeyFactory.sessionTelemetryStream(tenantId, sessionId);
      expect(key).toBe(`tenant:{${tenantId}}:session:${sessionId}:telemetry`);
    });

    it('generates sessionEventStream with correct format', () => {
      const key = KeyFactory.sessionEventStream(tenantId, sessionId);
      expect(key).toBe(`tenant:{${tenantId}}:session:${sessionId}:events`);
    });
  });

  describe('Cluster hashtag compliance', () => {
    it('all tenant-scoped keys share the same {tenantId} hashtag', () => {
      const keys = [
        KeyFactory.tenantHash(tenantId),
        KeyFactory.driverHash(tenantId, driverId),
        KeyFactory.driverGeoIndex(tenantId),
        KeyFactory.driverPresenceZset(tenantId),
        KeyFactory.sessionHash(tenantId, sessionId),
        KeyFactory.sessionTelemetryStream(tenantId, sessionId),
        KeyFactory.sessionEventStream(tenantId, sessionId),
      ];
      const hashtag = `{${tenantId}}`;
      for (const key of keys) {
        expect(key).toContain(hashtag);
      }
    });

    it('global keys do NOT contain a hashtag', () => {
      const globalKey = KeyFactory.sessionExpiryZset();
      expect(globalKey).not.toMatch(/\{[^}]+\}/);
    });

    it('lock keys do NOT contain a hashtag', () => {
      const lockKey = KeyFactory.sessionLock(sessionId);
      expect(lockKey).not.toMatch(/\{[^}]+\}/);
    });
  });

  describe('Lock keys', () => {
    it('generates sessionLock', () => {
      expect(KeyFactory.sessionLock(sessionId)).toBe(`lock:session:${sessionId}`);
    });

    it('generates driverLock', () => {
      expect(KeyFactory.driverLock(driverId)).toBe(`lock:driver:${driverId}`);
    });

    it('generates presenceScanLock', () => {
      expect(KeyFactory.presenceScanLock(tenantId)).toBe(`lock:presence:stale_scan:${tenantId}`);
    });

    it('generates candidateLock', () => {
      expect(KeyFactory.candidateLock(driverId, sessionId)).toBe(
        `lock:candidate:${driverId}:session:${sessionId}`
      );
    });
  });

  describe('Pub/Sub channels', () => {
    it('generates correct channel with prefix', () => {
      const channel = KeyFactory.pubSubChannel('motus', tenantId, 'driver.online');
      expect(channel).toBe(`motus:${tenantId}:events:driver.online`);
    });

    it('generates correct tenant wildcard pattern', () => {
      const pattern = KeyFactory.pubSubTenantWildcard('motus', tenantId);
      expect(pattern).toBe(`motus:${tenantId}:events:*`);
    });
  });

  describe('Expiry member encoding/decoding', () => {
    it('roundtrips tenantId:sessionId through encode/decode', () => {
      const member = KeyFactory.sessionExpiryMember(tenantId, sessionId);
      const parsed = KeyFactory.parseExpiryMember(member);
      expect(parsed).toEqual({ tenantId, sessionId });
    });

    it('returns null for invalid member format', () => {
      expect(KeyFactory.parseExpiryMember('no-colon-here')).toBeNull();
    });
  });
});
