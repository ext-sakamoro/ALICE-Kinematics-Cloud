const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  health: () => request<{ status: string; version: string; uptime_secs: number }>('/health'),
  solveIk: (body: { target_position: number[]; joint_count?: number }) =>
    request('/api/v1/kinematics/solve-ik', { method: 'POST', body: JSON.stringify(body) }),
  solveFk: (body: { joint_angles: number[]; link_lengths?: number[] }) =>
    request('/api/v1/kinematics/solve-fk', { method: 'POST', body: JSON.stringify(body) }),
  compressIntent: (body: { samples: { timestamp_ms: number; position: number[] }[]; sample_rate_hz?: number }) =>
    request('/api/v1/kinematics/compress-intent', { method: 'POST', body: JSON.stringify(body) }),
  optimizeTrajectory: (body: { waypoints: number[][]; max_velocity?: number }) =>
    request('/api/v1/kinematics/optimize-trajectory', { method: 'POST', body: JSON.stringify(body) }),
  chains: () => request('/api/v1/kinematics/chains'),
  stats: () => request('/api/v1/kinematics/stats'),
};
