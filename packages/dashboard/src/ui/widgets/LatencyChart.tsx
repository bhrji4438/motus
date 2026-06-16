import React from 'react';

interface LatencyChartProps {
  data: number[];
  labels: string[];
}

export const LatencyChart: React.FC<LatencyChartProps> = ({ data = [], labels = [] }) => {
  const chartHeight = 150;
  const chartWidth = 500;
  const padding = 20;

  // Find max value for scaling
  const maxVal = Math.max(...data, 5); // at least 5 for scale reference
  const pointsCount = data.length;

  // Build SVG path points
  const points = data.map((val, idx) => {
    const x = padding + (idx / (pointsCount - 1 || 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - (val / maxVal) * (chartHeight - padding * 2);
    return { x, y };
  });

  const pathD = points.length > 0 
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : '';

  // Gradient area path string
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z`
    : '';

  return (
    <div className="glass-panel">
      <h3 style={{ margin: '0 0 16px 0', fontFamily: 'Outfit' }}>Wave Dispatch Latency Trends</h3>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', overflow: 'visible' }}>
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="rgba(255, 255, 255, 0.05)" />
        <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="rgba(255, 255, 255, 0.05)" />
        <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="rgba(255, 255, 255, 0.08)" />

        {/* Gradient fill area */}
        {areaD && <path d={areaD} fill="url(#chartGradient)" />}

        {/* Main Line path */}
        {pathD && <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />}

        {/* Data points dots */}
        {points.map((p, idx) => (
          <circle key={idx} cx={p.x} cy={p.y} r="4" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
        ))}

        {/* Label guides */}
        <text x={padding} y={chartHeight - 4} fill="var(--text-muted)" fontSize="9" fontFamily="sans-serif">
          {labels[0] || 'Start'}
        </text>
        <text x={chartWidth - padding - 30} y={chartHeight - 4} fill="var(--text-muted)" fontSize="9" fontFamily="sans-serif">
          {labels[labels.length - 1] || 'End'}
        </text>
      </svg>
    </div>
  );
};
export default LatencyChart;
