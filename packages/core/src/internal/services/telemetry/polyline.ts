import { Coordinates } from "@motus/types";

function encodeValue(val: number): string {
  let v = Math.round(val * 1e5);
  v = v < 0 ? ~(v << 1) : v << 1;
  let str = "";
  while (v >= 0x20) {
    str += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  str += String.fromCharCode(v + 63);
  return str;
}

/**
 * Encodes a series of Coordinate points using the Google Polyline Algorithm.
 */
export function encodePolyline(points: readonly Coordinates[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let result = "";

  for (const point of points) {
    const lat = point.latitude;
    const lng = point.longitude;

    const dLat = lat - lastLat;
    const dLng = lng - lastLng;

    result += encodeValue(dLat);
    result += encodeValue(dLng);

    lastLat = lat;
    lastLng = lng;
  }

  return result;
}

/**
 * Decodes a Google Polyline string back into a list of Coordinate points.
 */
export function decodePolyline(str: string): Coordinates[] {
  const points: Coordinates[] = [];
  let index = 0;
  const len = str.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}
