import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, changeLabel, trend, icon }) => {
  const getTrendColor = () => {
    if (trend === 'up') return 'var(--accent-success)';
    if (trend === 'down') return 'var(--accent-danger)';
    return 'var(--text-muted)';
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500 }}>{title}</span>
        <h2 style={{ fontSize: '36px', margin: '8px 0', fontFamily: 'Outfit', fontWeight: 700 }}>{value}</h2>
        {changeLabel && (
          <span style={{ fontSize: '12px', color: getTrendColor(), fontWeight: 600 }}>
            {trend === 'up' && '↑ '}
            {trend === 'down' && '↓ '}
            {changeLabel}
          </span>
        )}
      </div>
      {icon && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-glass)',
          borderRadius: '12px',
          width: '48px',
          height: '48px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'var(--accent-primary)'
        }}>
          {icon}
        </div>
      )}
    </div>
  );
};
export default MetricCard;
