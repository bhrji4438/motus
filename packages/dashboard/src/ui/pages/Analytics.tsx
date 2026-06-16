import React, { useState } from 'react';

interface AnalyticsProps {
  tenantId: string;
}

export const Analytics: React.FC<AnalyticsProps> = ({ tenantId }) => {
  const [dateRange, setDateRange] = useState('7d');

  const stats = [
    { label: 'Wave Matching Success Rate', value: '96.5%', desc: 'Percentage of waves matching candidates' },
    { label: 'OSRM Route Latency (Avg)', value: '142ms', desc: 'Average route engine calculation duration' },
    { label: 'Telemetry Volume', value: '42.1K pts', desc: 'Buffered points ingest queue' },
  ];

  const handleExport = () => {
    // CSV export simulation link
    const csvContent = "data:text/csv;charset=utf-8,Metric,Value,Date\nSuccessRate,96.5%,2026-06\nLatency,142ms,2026-06";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `analytics-report-${tenantId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="glass-panel" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: '0 0 8px 0', fontFamily: 'Outfit' }}>Select Analysis Range</h3>
          <select className="form-input" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
        <button className="btn" onClick={handleExport}>
          Export CSV Summary
        </button>
      </div>

      <div className="dashboard-grid">
        {stats.map((stat, idx) => (
          <div key={idx} className="glass-panel">
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{stat.label}</span>
            <h2 style={{ fontSize: '32px', margin: '8px 0', fontFamily: 'Outfit', color: 'var(--accent-primary)' }}>{stat.value}</h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{stat.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
export default Analytics;
