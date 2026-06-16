import React from 'react';

interface QueuesProps {
  tenantId: string;
}

export const Queues: React.FC<QueuesProps> = ({ tenantId: _tenantId }) => {
  const mockQueues = [
    { name: 'dispatch-stream', size: 142, backlog: 3, groups: 2, workers: 4 },
    { name: 'telemetry-stream', size: 12450, backlog: 0, groups: 1, workers: 8 },
  ];

  return (
    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Queue / Stream Name</th>
            <th>Message Size</th>
            <th>Backlog Count</th>
            <th>Consumer Groups</th>
            <th>Active Workers</th>
          </tr>
        </thead>
        <tbody>
          {mockQueues.map((q, idx) => (
            <tr key={idx}>
              <td><strong>{q.name}</strong></td>
              <td>{q.size}</td>
              <td>
                <span className={`badge ${q.backlog > 0 ? 'badge-warning' : 'badge-success'}`}>
                  {q.backlog} pending
                </span>
              </td>
              <td>{q.groups}</td>
              <td>{q.workers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
export default Queues;
