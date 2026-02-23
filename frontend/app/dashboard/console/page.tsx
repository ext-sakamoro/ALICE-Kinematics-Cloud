'use client';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
type Tab = 'ik' | 'fk' | 'intent' | 'trajectory' | 'chains';

export default function ConsolePage() {
  const [tab, setTab] = useState<Tab>('ik');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  // IK state
  const [targetX, setTargetX] = useState('0.5');
  const [targetY, setTargetY] = useState('0.3');
  const [targetZ, setTargetZ] = useState('0.8');
  const [jointCount, setJointCount] = useState('7');

  // FK state
  const [angles, setAngles] = useState('0.1, 0.3, -0.2, 0.5, 0.1, -0.4, 0.2');
  const [linkLengths, setLinkLengths] = useState('0.3, 0.25, 0.2, 0.15, 0.12, 0.1, 0.08');

  // Trajectory state
  const [waypoints, setWaypoints] = useState('0,0,0\n0.5,0.3,0.2\n1.0,0.5,0.8\n1.2,0.2,0.5');
  const [maxVel, setMaxVel] = useState('1.0');

  const doFetch = async (path: string, body: unknown) => {
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': 'demo' }, body: JSON.stringify(body) });
      setResult(await r.json());
    } catch (e) { setResult({ error: (e as Error).message }); } finally { setLoading(false); }
  };

  const doGet = async (path: string) => {
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${API}${path}`, { headers: { 'X-API-Key': 'demo' } });
      setResult(await r.json());
    } catch (e) { setResult({ error: (e as Error).message }); } finally { setLoading(false); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ik', label: 'Inverse Kinematics' },
    { key: 'fk', label: 'Forward Kinematics' },
    { key: 'intent', label: 'Intent Compression' },
    { key: 'trajectory', label: 'Trajectory' },
    { key: 'chains', label: 'Chains' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Kinematics Console</h1>
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setResult(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ik' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Target Position</h3>
          <div className="grid grid-cols-4 gap-3">
            <Input label="X" value={targetX} onChange={setTargetX} />
            <Input label="Y" value={targetY} onChange={setTargetY} />
            <Input label="Z" value={targetZ} onChange={setTargetZ} />
            <Input label="Joints" value={jointCount} onChange={setJointCount} />
          </div>
          <button onClick={() => doFetch('/api/v1/kinematics/solve-ik', { target_position: [+targetX, +targetY, +targetZ], joint_count: +jointCount })}
            disabled={loading} className="px-4 py-2 bg-violet-600 text-white rounded-md text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
            {loading ? 'Solving...' : 'Solve IK'}
          </button>
          {result && !('error' in result) && (
            <div className="border border-border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Converged" value={result.converged ? 'Yes' : 'No'} accent={!!result.converged} />
                <Stat label="Iterations" value={String(result.iterations ?? '-')} />
                <Stat label="Error" value={`${Number(result.error_distance ?? 0).toFixed(6)} m`} />
                <Stat label="Time" value={`${result.elapsed_us} us`} />
              </div>
              {Array.isArray(result.joint_angles) && (
                <div><h4 className="text-xs font-semibold text-muted-foreground mb-1">Joint Angles (rad)</h4>
                  <div className="flex flex-wrap gap-2">
                    {(result.joint_angles as number[]).map((a, i) => (
                      <span key={i} className="px-2 py-1 bg-muted rounded text-xs font-mono">J{i}: {Number(a).toFixed(4)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'fk' && (
        <div className="space-y-4">
          <Input label="Joint Angles (comma-separated radians)" value={angles} onChange={setAngles} wide />
          <Input label="Link Lengths (comma-separated meters)" value={linkLengths} onChange={setLinkLengths} wide />
          <button onClick={() => doFetch('/api/v1/kinematics/solve-fk', {
            joint_angles: angles.split(',').map(Number), link_lengths: linkLengths.split(',').map(Number),
          })} disabled={loading} className="px-4 py-2 bg-violet-600 text-white rounded-md text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
            {loading ? 'Solving...' : 'Solve FK'}
          </button>
          {result && !('error' in result) && (
            <div className="border border-border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold">End Effector</h3>
              <div className="grid grid-cols-2 gap-3">
                {result.end_effector_position && <Stat label="Position" value={(result.end_effector_position as number[]).map(v => v.toFixed(4)).join(', ')} />}
                <Stat label="Time" value={`${result.elapsed_us} us`} />
              </div>
              {Array.isArray(result.joint_positions) && (
                <div><h4 className="text-xs font-semibold text-muted-foreground mb-1">Joint Positions</h4>
                  <div className="space-y-1">
                    {(result.joint_positions as number[][]).map((p, i) => (
                      <div key={i} className="text-xs font-mono text-muted-foreground">J{i}: [{p.map(v => v.toFixed(4)).join(', ')}]</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'intent' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Generate sample 1000Hz motion data and compress to 8-byte intent</p>
          <button onClick={() => {
            const samples = Array.from({ length: 100 }, (_, i) => ({
              timestamp_ms: i * 10, position: [Math.sin(i * 0.1) * 0.5, Math.cos(i * 0.1) * 0.3, i * 0.005],
            }));
            doFetch('/api/v1/kinematics/compress-intent', { samples, sample_rate_hz: 100 });
          }} disabled={loading} className="px-4 py-2 bg-violet-600 text-white rounded-md text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
            {loading ? 'Compressing...' : 'Generate & Compress (100 samples)'}
          </button>
          {result && !('error' in result) && (
            <div className="border border-border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Intent" value={String(result.intent_type ?? '-')} accent />
                <Stat label="Compressed" value={`${result.compressed_bytes} bytes`} />
                <Stat label="Samples" value={String(result.original_samples ?? '-')} />
                <Stat label="Ratio" value={`${Number(result.compression_ratio ?? 0).toFixed(1)}x`} accent />
              </div>
              {result.direction && (
                <Stat label="Direction" value={(result.direction as number[]).map(v => v.toFixed(4)).join(', ')} />
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'trajectory' && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Waypoints (x,y,z per line)</label>
            <textarea rows={6} value={waypoints} onChange={(e) => setWaypoints(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm font-mono resize-none" />
          </div>
          <Input label="Max Velocity (m/s)" value={maxVel} onChange={setMaxVel} />
          <button onClick={() => doFetch('/api/v1/kinematics/optimize-trajectory', {
            waypoints: waypoints.split('\n').filter(Boolean).map(l => l.split(',').map(Number)),
            max_velocity: +maxVel,
          })} disabled={loading} className="px-4 py-2 bg-violet-600 text-white rounded-md text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
            {loading ? 'Optimizing...' : 'Optimize'}
          </button>
          {result && !('error' in result) && (
            <div className="border border-border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Distance" value={`${Number(result.total_distance ?? 0).toFixed(4)} m`} />
                <Stat label="Time" value={`${Number(result.total_time ?? 0).toFixed(3)} s`} />
                <Stat label="Max Vel" value={`${Number(result.max_velocity_reached ?? 0).toFixed(3)} m/s`} accent />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'chains' && (
        <div className="space-y-4">
          <button onClick={() => doGet('/api/v1/kinematics/chains')} disabled={loading}
            className="px-4 py-2 bg-violet-600 text-white rounded-md text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
            {loading ? 'Loading...' : 'Load Chains'}
          </button>
          {result && Array.isArray(result) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(result as Array<Record<string, unknown>>).map((c) => (
                <div key={String(c.id)} className="border border-border rounded-lg p-4">
                  <h3 className="font-semibold">{String(c.name)}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{String(c.description)}</p>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="text-violet-400 font-medium">{String(c.dof)} DOF</span>
                    <span className="text-muted-foreground">{String(c.joint_type)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {result && 'error' in result && <p className="text-sm text-red-500">{String(result.error)}</p>}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-3 py-2 bg-muted rounded-md">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${accent ? 'text-violet-400' : ''}`}>{value}</div>
    </div>
  );
}

function Input({ label, value, onChange, wide }: { label: string; value: string; onChange: (v: string) => void; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-full' : ''}>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm font-mono" />
    </div>
  );
}
