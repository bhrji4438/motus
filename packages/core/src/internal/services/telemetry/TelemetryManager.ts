import { Coordinates, TelemetryPoint } from '@motus/types';
import { calculateHaversineDistance } from '@/internal/services/matching/haversine.js';
import { encodePolyline } from '@/internal/services/telemetry/polyline.js';

export class TelemetryManager {
  /**
   * Evaluates adaptive sampling rules. Returns true if the coordinate should be sampled.
   * Sample only if distance delta > 25m OR time delta > 10s.
   */
  public shouldSample(
    lastSample: Coordinates & { timestamp: string },
    newPoint: Coordinates & { timestamp: string }
  ): boolean {
    const dist = calculateHaversineDistance(lastSample, newPoint);
    if (dist > 25) {
      return true;
    }

    const t1 = new Date(lastSample.timestamp).getTime();
    const t2 = new Date(newPoint.timestamp).getTime();
    const durationSec = (t2 - t1) / 1000;

    return durationSec > 10;
  }

  /**
   * Compresses a series of telemetry points into a Google Polyline string.
   */
  public compressPath(points: readonly TelemetryPoint[]): string {
    return encodePolyline(points);
  }

  /**
   * Computes trajectory distance, duration, average speed, and idle duration.
   */
  public calculateMetrics(points: readonly TelemetryPoint[]): {
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    idleDurationSeconds: number;
    avgSpeedMps: number;
  } {
    if (points.length < 2) {
      return {
        totalDistanceMeters: 0,
        totalDurationSeconds: 0,
        idleDurationSeconds: 0,
        avgSpeedMps: 0
      };
    }

    let totalDistanceMeters = 0;
    let idleDurationSeconds = 0;

    const tStart = new Date(points[0].timestamp).getTime();
    const tEnd = new Date(points[points.length - 1].timestamp).getTime();
    const totalDurationSeconds = (tEnd - tStart) / 1000;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      // Sum distances
      totalDistanceMeters += calculateHaversineDistance(p1, p2);

      // Accumulate idle time: speed < 1.0 m/s
      if (p1.speed !== undefined && p1.speed < 1.0) {
        const t1 = new Date(p1.timestamp).getTime();
        const t2 = new Date(p2.timestamp).getTime();
        idleDurationSeconds += (t2 - t1) / 1000;
      }
    }

    const avgSpeedMps = totalDurationSeconds > 0 ? totalDistanceMeters / totalDurationSeconds : 0;

    return {
      totalDistanceMeters,
      totalDurationSeconds,
      idleDurationSeconds,
      avgSpeedMps
    };
  }
}
