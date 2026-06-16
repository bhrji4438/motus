import React from 'react';

export interface TraceSpan {
  spanId: string;
  traceId: string;
  name: string;
  startTimeUnixNano: number;
  durationMs: number;
  attributes: Record<string, string>;
  error?: string;
}

interface TraceVisualizerProps {
  spans: TraceSpan[];
}

export const TraceVisualizer: React.FC<TraceVisualizerProps> = ({ spans }) => {
  if (!spans || spans.length === 0) {
    return <div style={{ color: 'var(--text-muted)' }}>No tracing data available for this session.</div>;
  }

  // Find trace boundary times to scale the waterfall diagram
  const startTimes = spans.map(s => s.startTimeUnixNano);
  const minStart = Math.min(...startTimes);
  
  const endTimes = spans.map(s => s.startTimeUnixNano + s.durationMs * 1000000);
  const maxEnd = Math.max(...endTimes);
  
  const totalDurationNano = maxEnd - minStart || 1;

  return (
    <div className="glass-panel" style={{ marginTop: '24px' }}>
      <h3 style={{ margin: '0 0 20px 0', fontFamily: 'Outfit' }}>Distributed Trace Timeline (W3C OpenTelemetry)</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {spans.map((span) => {
          const relativeStart = span.startTimeUnixNano - minStart;
          const leftPercent = (relativeStart / totalDurationNano) * 100;
          const spanDurationNano = span.durationMs * 1000000;
          const widthPercent = Math.max((spanDurationNano / totalDurationNano) * 100, 2); // At least 2% width

          return (
            <div key={span.spanId} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{span.name}</span>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{span.durationMs.toFixed(1)} ms</span>
              </div>
              
              {/* Waterfall Timeline Bar */}
              <div style={{
                width: '100%',
                height: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
                  borderRadius: '6px'
                }} />
              </div>

              {/* Attributes tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                {Object.entries(span.attributes).map(([key, val]) => (
                  <span key={key} style={{
                    fontSize: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-glass)'
                  }}>
                    {key}: {val}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default TraceVisualizer;
