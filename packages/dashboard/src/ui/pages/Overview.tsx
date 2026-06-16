import React from 'react';
import MetricCard from '@/ui/widgets/MetricCard.js';
import LatencyChart from '@/ui/widgets/LatencyChart.js';
import LiveMap from '@/ui/widgets/LiveMap.js';

interface OverviewProps {
  tenantId: string;
}

export const Overview: React.FC<OverviewProps> = ({ tenantId: _tenantId }) => {
  // Mock live telemetry counters
  const metrics = [
    { title: 'Active Tracking Sessions', value: 3, trend: 'up' as const, changeLabel: '+12% vs last hour' },
    { title: 'Online Dispatch Drivers', value: 42, trend: 'neutral' as const, changeLabel: 'Presence stable' },
    { title: 'Wave Matching Success', value: '96.5%', trend: 'up' as const, changeLabel: '+2.1% improvement' },
    { title: 'Active Stream Backlog', value: 3, trend: 'down' as const, changeLabel: '-50% reduction' },
  ];

  // SVG Chart sample parameters
  const chartData = [1.2, 2.5, 3.1, 1.8, 4.2, 3.4, 2.8, 3.2, 1.5];
  const chartLabels = ['12:00', '12:05', '12:10', '12:15', '12:20', '12:25', '12:30', '12:35', '12:40'];

  return (
    <div>
      <div className="dashboard-grid">
        {metrics.map((m, idx) => (
          <MetricCard
            key={idx}
            title={m.title}
            value={m.value}
            trend={m.trend}
            changeLabel={m.changeLabel}
          />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '24px', marginBottom: '24px' }}>
        <LiveMap
          pickup={{ latitude: 37.7749, longitude: -122.4194 }}
          destination={{ latitude: 37.7891, longitude: -122.4014 }}
          path={[
            { latitude: 37.7749, longitude: -122.4194 },
            { latitude: 37.7794, longitude: -122.4132 },
            { latitude: 37.7842, longitude: -122.4081 },
            { latitude: 37.7891, longitude: -122.4014 }
          ]}
          drivers={[
            { id: 'driver-1', location: { latitude: 37.7749, longitude: -122.4194 }, status: 'ONLINE' },
            { id: 'driver-2', location: { latitude: 37.7849, longitude: -122.4094 }, status: 'BUSY' },
          ]}
        />
        <LatencyChart data={chartData} labels={chartLabels} />
      </div>
    </div>
  );
};
export default Overview;
