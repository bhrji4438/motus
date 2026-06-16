import React, { useState } from 'react';
import Overview from '@/ui/pages/Overview.js';
import Sessions from '@/ui/pages/Sessions.js';
import Drivers from '@/ui/pages/Drivers.js';
import Analytics from '@/ui/pages/Analytics.js';
import AuditLogs from '@/ui/pages/AuditLogs.js';
import Queues from '@/ui/pages/Queues.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'drivers' | 'analytics' | 'audit' | 'queues'>('overview');
  const [userRole, setUserRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'DISPATCHER' | 'SUPPORT' | 'ANALYST' | 'VIEWER'>('SUPER_ADMIN');
  const [tenantId, setTenantId] = useState('T1');

  const renderContent = () => {
    switch (activeTab) {
      case 'sessions':
        return <Sessions tenantId={tenantId} />;
      case 'drivers':
        return <Drivers tenantId={tenantId} />;
      case 'analytics':
        return <Analytics tenantId={tenantId} />;
      case 'audit':
        return <AuditLogs tenantId={tenantId} />;
      case 'queues':
        return <Queues tenantId={tenantId} />;
      case 'overview':
      default:
        return <Overview tenantId={tenantId} />;
    }
  };

  return (
    <div className="layout-container">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="sidebar-title">
          <span>MOTUS Control</span>
        </div>
        <nav style={{ flex: 1 }}>
          <button className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`} style={{ border: 'none', background: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }} onClick={() => setActiveTab('overview')}>
            ● Overview
          </button>
          <button className={`nav-link ${activeTab === 'sessions' ? 'active' : ''}`} style={{ border: 'none', background: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }} onClick={() => setActiveTab('sessions')}>
            ● Sessions
          </button>
          <button className={`nav-link ${activeTab === 'drivers' ? 'active' : ''}`} style={{ border: 'none', background: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }} onClick={() => setActiveTab('drivers')}>
            ● Live Drivers
          </button>
          <button className={`nav-link ${activeTab === 'analytics' ? 'active' : ''}`} style={{ border: 'none', background: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }} onClick={() => setActiveTab('analytics')}>
            ● Analytics
          </button>
          <button className={`nav-link ${activeTab === 'audit' ? 'active' : ''}`} style={{ border: 'none', background: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }} onClick={() => setActiveTab('audit')}>
            ● Audit Logs
          </button>
          <button className={`nav-link ${activeTab === 'queues' ? 'active' : ''}`} style={{ border: 'none', background: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }} onClick={() => setActiveTab('queues')}>
            ● Queue status
          </button>
        </nav>

        {/* RBAC Role Selector widget in sidebar footer */}
        <div className="glass-panel" style={{ padding: '12px', marginTop: 'auto', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div><strong>Tenant Context:</strong></div>
          <select className="form-input" style={{ fontSize: '11px', padding: '4px' }} value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
            <option value="T1">Tenant 1 (US)</option>
            <option value="T2">Tenant 2 (EU)</option>
          </select>
          <div style={{ marginTop: '4px' }}><strong>Access Level:</strong></div>
          <select className="form-input" style={{ fontSize: '11px', padding: '4px' }} value={userRole} onChange={(e) => setUserRole(e.target.value as any)}>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="DISPATCHER">Dispatcher</option>
            <option value="SUPPORT">Support</option>
            <option value="ANALYST">Analyst</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </div>
      </div>

      {/* Main panel area */}
      <div className="main-content">
        <header className="content-header">
          <div>
            <h1 className="content-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              Dashboard Console
              <span className="badge badge-info" style={{ fontSize: '11px' }}>{userRole}</span>
            </h1>
            <p className="content-subtitle">Real-time status monitoring for Tenant {tenantId}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <span className="status-pulse pulse-success" /> System engine normal
          </div>
        </header>

        {/* Tab content panel */}
        {renderContent()}
      </div>
    </div>
  );
};
export default App;
