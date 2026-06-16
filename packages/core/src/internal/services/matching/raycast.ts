import { Coordinates } from "@motus/types";

/**
 * Validates whether a geographic point lies inside a boundary polygon using the Ray-casting algorithm.
 * The boundary should be represented as a list of Coordinate points.
 */
export function isPointInPolygon(
  point: Coordinates,
  polygon: readonly Coordinates[]
): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let isInside = false;
  const px = point.longitude;
  const py = point.latitude;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersect) {
      isInside = !isInside;
    }
  }

  return isInside;
}
