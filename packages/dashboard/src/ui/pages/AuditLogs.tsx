import React, { useState } from 'react';

interface AuditLogsProps {
  tenantId: string;
}

export const AuditLogs: React.FC<AuditLogsProps> = ({ tenantId }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const mockLogs = [
    { actor: 'Dispatcher-12', role: 'DISPATCHER', action: 'Session Assigned', resource: 'S100', time: new Date().toISOString() },
    { actor: 'Admin-3', role: 'ADMIN', action: 'Settings Modified', resource: 'matchingConfig', time: new Date().toISOString() },
    { actor: 'Support-9', role: 'SUPPORT', action: 'Inspect Traces', resource: 'S102', time: new Date().toISOString() },
  ];

  const filteredLogs = mockLogs.filter(
    log =>
      log.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontFamily: 'Outfit' }}>Search Audit Logs ({tenantId})</h3>
        <input
          type="text"
          className="form-input"
          placeholder="Search actor or action..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '300px' }}
        />
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Actor ID</th>
              <th>Role</th>
              <th>Action</th>
              <th>Resource ID</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log, idx) => (
              <tr key={idx}>
                <td>{log.actor}</td>
                <td>{log.role}</td>
                <td>{log.action}</td>
                <td>{log.resource}</td>
                <td>{log.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default AuditLogs;
