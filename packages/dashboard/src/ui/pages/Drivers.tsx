import React from 'react';

interface DriversProps {
  tenantId: string;
}

export const Drivers: React.FC<DriversProps> = ({ tenantId: _tenantId }) => {
  const mockDrivers = [
    { id: 'driver-1', status: 'ONLINE', load: '0/3', location: '37.7749, -122.4194', heartbeat: 'Active' },
    { id: 'driver-2', status: 'BUSY', load: '3/3', location: '37.7849, -122.4094', heartbeat: 'Active' },
    { id: 'driver-3', status: 'STALE', load: '0/2', location: '37.7949, -122.3994', heartbeat: 'Missed' },
  ];

  return (
    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Driver ID</th>
            <th>Status</th>
            <th>Current Load</th>
            <th>Last Location</th>
            <th>Heartbeat</th>
          </tr>
        </thead>
        <tbody>
          {mockDrivers.map((driver) => (
            <tr key={driver.id}>
              <td>{driver.id}</td>
              <td>
                <span className={`badge ${driver.status === 'ONLINE' ? 'badge-success' : driver.status === 'BUSY' ? 'badge-warning' : 'badge-danger'}`}>
                  {driver.status}
                </span>
              </td>
              <td>{driver.load}</td>
              <td>{driver.location}</td>
              <td>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`status-pulse ${driver.heartbeat === 'Active' ? 'pulse-success' : 'pulse-warning'}`} />
                  {driver.heartbeat}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
export default Drivers;
