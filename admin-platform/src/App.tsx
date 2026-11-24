
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, ShieldAlert, Activity, Users, Database,
  Eye, Lock, Terminal
} from 'lucide-react';
import { Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// --- Components ---

const Sidebar = ({ active, setActive }: any) => {
  const items = [
    { id: 'dashboard', label: 'God Mode', icon: LayoutDashboard },
    { id: 'telemetry', label: 'Legal Pixel™', icon: Activity },
    { id: 'security', label: 'Security Core', icon: ShieldAlert },
    { id: 'tenants', label: 'Tenants & Plans', icon: Users },
    { id: 'database', label: 'Raw Data', icon: Database },
    { id: 'audit', label: 'Session Replay', icon: Eye },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen fixed">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-indigo-500 flex items-center gap-2">
          <Lock size={20} /> MASTER<span className="text-white">ADMIN</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">v.2.0.0-alpha • ROOT_ACCESS</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${active === item.id
              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center font-bold text-xs">SU</div>
          <div className="flex-1">
            <div className="text-sm font-bold text-slate-200">Super Admin</div>
            <div className="text-xs text-slate-500">Security Level 5</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

const MetricCard = ({ title, value, sub, color = "indigo" }: any) => (
  <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl">
    <h3 className="text-slate-400 text-sm font-medium mb-2">{title}</h3>
    <div className="text-3xl font-bold text-slate-100">{value}</div>
    {sub && <div className={`text-xs mt-2 ${color === 'red' ? 'text-red-400' : 'text-emerald-400'}`}>{sub}</div>}
  </div>
);

// --- Pages ---

const DashboardPage = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Stats
        const statsRes = await fetch('http://localhost:3000/admin-api/stats');
        const statsData = await statsRes.json();
        setStats(statsData);

        // Fetch Logs
        const logsRes = await fetch('http://localhost:3000/admin-api/logs');
        const logsData = await logsRes.json();

        if (Array.isArray(logsData)) {
          setLogs(logsData);
        } else {
          setLogs([]);
        }
      } catch (e) {
        console.error("Failed to fetch admin data", e);
        setLogs([]); // Safe fallback
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  // Mock Chart Data (Keep mixed for visual appeal until Traffic Endpoint fully ready)
  const chartData = [
    { time: '09:00', events: 400, risk: 10 },
    { time: '10:00', events: 300, risk: 20 },
    { time: '11:00', events: 550, risk: 15 },
    { time: '12:00', events: 800, risk: 40 },
    { time: '13:00', events: 450, risk: 10 },
    { time: '14:00', events: 600, risk: 5 },
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">System Overview</h2>
          <p className="text-slate-400">Real-time infrastructure monitoring</p>
        </div>
        <div className="flex gap-3">
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> LIVE CONNECTED
          </span>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-6">
        <MetricCard title="Active Sessions" value={stats?.activeSessions || '-'} sub="Real-time" />
        <MetricCard title="Events Total" value={stats?.eventsTotal || '-'} sub="Since boot" />
        <MetricCard title="Active Tenants" value={stats?.tenantsActive || '-'} sub="Registered" />
        <MetricCard title="System Health" value={(stats?.systemHealth || 99) + '%'} sub="Optimal" color="green" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-6">Traffic & Risk Correlation</h3>
          <div className="h-[300px] w-full" style={{ minHeight: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#475569" />
                <YAxis stroke="#475569" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="events" stroke="#6366f1" fillOpacity={1} fill="url(#colorEvents)" />
                <Line type="monotone" dataKey="risk" stroke="#ef4444" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Live Logs (Legal Pixel)</h3>
          <div className="space-y-3 font-mono text-xs overflow-y-auto max-h-[300px]">
            {logs.length === 0 && <div className="text-slate-500 italic">Waiting for events...</div>}
            {logs.map((log: any) => (
              <div key={log.id} className="flex gap-2 p-2 rounded bg-slate-900/50 border border-slate-800 animate-in slide-in-from-right duration-300">
                <span className={log.riskScore > 50 ? 'text-red-400 font-bold' : 'text-indigo-400'}>{log.eventType}</span>
                <span className="text-slate-500 truncate w-20">{log.actorId || 'anon'}</span>
                <span className="text-slate-400 flex-1 text-right">{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700 text-center">
            <button className="text-indigo-400 text-sm hover:underline flex items-center justify-center gap-2">
              <Terminal size={14} /> View All Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100 font-sans">
      <Sidebar active={activeTab} setActive={setActiveTab} />
      <main className="flex-1 ml-64">
        {activeTab === 'dashboard' && <DashboardPage />}
        {activeTab === 'telemetry' && <div className="p-8 text-2xl font-bold text-slate-500">Legal Pixel Data Lake (Implementation Pending)</div>}
        {activeTab === 'security' && <div className="p-8 text-2xl font-bold text-slate-500">Security Audit Logs (Implementation Pending)</div>}
      </main>
    </div>
  );
}

export default App;
