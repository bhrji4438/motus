import React, { useRef, useEffect } from 'react';

export interface MapPoint {
  latitude: number;
  longitude: number;
}

interface LiveMapProps {
  pickup?: MapPoint;
  destination?: MapPoint;
  path?: MapPoint[];
  drivers?: { id: string; location: MapPoint; status: string }[];
}

export const LiveMap: React.FC<LiveMapProps> = ({ pickup, destination, path = [], drivers = [] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background map grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Coordinates bounding box translation
    // We assume default coordinates map to San Francisco boundary box if not specified
    const defaultCenterLat = 37.78;
    const defaultCenterLng = -122.41;
    
    // Simple projection function: maps Lat/Lng to Canvas X/Y centered on coordinates
    const project = (lat: number, lng: number) => {
      const scale = 5000; // zoom level scale factor
      const x = canvas.width / 2 + (lng - defaultCenterLng) * scale;
      const y = canvas.height / 2 - (lat - defaultCenterLat) * scale; // inverted Y axis
      return { x, y };
    };

    // 1. Draw route line path
    if (path.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.setLineDash([0]);
      
      const start = project(path[0].latitude, path[0].longitude);
      ctx.moveTo(start.x, start.y);
      
      for (let i = 1; i < path.length; i++) {
        const pt = project(path[i].latitude, path[i].longitude);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }

    // 2. Draw Pickup Marker
    if (pickup) {
      const pt = project(pickup.latitude, pickup.longitude);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#10b981'; // Green for pickup
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('P', pt.x - 3, pt.y + 3);
    }

    // 3. Draw Destination Marker
    if (destination) {
      const pt = project(destination.latitude, destination.longitude);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#ef4444'; // Red for destination
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('D', pt.x - 3, pt.y + 3);
    }

    // 4. Draw Driver Markers
    drivers.forEach(driver => {
      const pt = project(driver.location.latitude, driver.location.longitude);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = driver.status === 'BUSY' ? '#f59e0b' : '#3b82f6';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Label driver ID
      ctx.fillStyle = '#9ca3af';
      ctx.font = '9px sans-serif';
      ctx.fillText(driver.id, pt.x + 10, pt.y + 3);
    });

  }, [pickup, destination, path, drivers]);

  return (
    <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', height: '400px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10, display: 'flex', gap: '8px' }}>
        <span className="badge badge-success">● Pickup (P)</span>
        <span className="badge badge-danger">● Destination (D)</span>
        <span className="badge badge-info">● Drivers</span>
      </div>
      <canvas
        ref={canvasRef}
        width={750}
        height={400}
        style={{ display: 'block', width: '100%', height: '100%', background: '#0a0d16' }}
      />
    </div>
  );
};
export default LiveMap;
