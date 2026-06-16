import React, { useState } from 'react';
import TraceVisualizer, { TraceSpan } from '@/ui/widgets/TraceVisualizer.js';

interface SessionsProps {
  tenantId: string;
}

export const Sessions: React.FC<SessionsProps> = ({ tenantId }) => {
  const [selectedSession, setSelectedSession] = useState<string | null>('S100');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const mockSessions = [
    { id: 'S100', tenantId, status: 'IN_PROGRESS', pickup: '37.7749, -122.4194', dest: '37.7891, -122.4014', driver: 'driver-1' },
    { id: 'S101', tenantId, status: 'SEARCHING', pickup: '37.7654, -122.4432', dest: '37.7821, -122.4312', driver: 'Pending' },
    { id: 'S102', tenantId, status: 'COMPLETED', pickup: '37.7511, -122.4221', dest: '37.7689, -122.4111', driver: 'driver-2' },
  ];

  const mockSpansMap: Record<string, TraceSpan[]> = {
    S100: [
      {
        spanId: 'span-1',
        traceId: 'trace-100',
        name: 'POST /tenants/T1/sessions',
        startTimeUnixNano: 1718164000000000000,
        durationMs: 42,
        attributes: { 'http.status_code': '201', 'db.system': 'redis' },
      },
      {
        spanId: 'span-2',
        traceId: 'trace-100',
        name: 'MatchingEngine.scoreCandidates',
        startTimeUnixNano: 1718164000042000000,
        durationMs: 125,
        attributes: { 'db.system': 'redis', 'db.operation': 'lua' },
      },
      {
        spanId: 'span-3',
        traceId: 'trace-100',
        name: 'APNS.send',
        startTimeUnixNano: 1718164000170000000,
        durationMs: 82,
        attributes: { 'messaging.system': 'apns' },
      },
    ],
    S101: [
      {
        spanId: 'span-4',
        traceId: 'trace-101',
        name: 'POST /tenants/T1/sessions',
        startTimeUnixNano: 1718164500000000000,
        durationMs: 38,
        attributes: { 'http.status_code': '201' },
      },
    ],
    S102: [],
  };

  const filteredSessions = mockSessions.filter(
    s => statusFilter === 'ALL' || s.status === statusFilter
  );

  return (
    <div>
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontFamily: 'Outfit' }}>Sessions Filter</h3>
        <select
          className="form-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: '200px' }}
        >
          <option value="ALL">All Statuses</option>
          <option value="SEARCHING">Searching</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Sessions list */}
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Status</th>
                <th>Driver</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((session) => (
                <tr key={session.id} style={{ background: selectedSession === session.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                  <td>{session.id}</td>
                  <td>
                    <span className={`badge ${session.status === 'COMPLETED' ? 'badge-success' : session.status === 'SEARCHING' ? 'badge-warning' : 'badge-info'}`}>
                      {session.status}
                    </span>
                  </td>
                  <td>{session.driver}</td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => setSelectedSession(session.id)}>
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Selected inspect detail */}
        <div>
          {selectedSession ? (
            <div>
              <div className="glass-panel">
                <h3 style={{ margin: '0 0 16px 0', fontFamily: 'Outfit' }}>Session Detail: {selectedSession}</h3>
                {mockSessions
                  .filter(s => s.id === selectedSession)
                  .map(s => (
                    <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                      <div><strong>Pickup:</strong> {s.pickup}</div>
                      <div><strong>Destination:</strong> {s.dest}</div>
                      <div><strong>Assigned Driver:</strong> {s.driver}</div>
                    </div>
                  ))}
              </div>

              {/* Span Timeline waterfall visualizer */}
              <TraceVisualizer spans={mockSpansMap[selectedSession] || []} />
            </div>
          ) : (
            <div className="glass-panel" style={{ color: 'var(--text-muted)' }}>
              Select a session to inspect detailed execution traces.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default Sessions;
