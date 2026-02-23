import Link from 'next/link';

const features = [
  { title: 'Inverse Kinematics', desc: 'Damped least-squares IK solver for any kinematic chain' },
  { title: 'Motion Intent Compression', desc: '1000Hz motion data compressed to 8 bytes per intent' },
  { title: 'Trajectory Optimization', desc: 'Smooth, velocity-constrained path planning' },
  { title: 'Forward Kinematics', desc: 'Joint angle to end-effector position computation' },
];

const chains = ['Human Arm (7-DOF)', 'Human Leg (6-DOF)', 'Robotic Arm (6-DOF)', 'Delta Robot (3-DOF)', 'SCARA (4-DOF)'];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">ALICE Kinematics Cloud</h1>
          <div className="flex gap-3">
            <Link href="/auth/login" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link href="/auth/register" className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90">Get Started</Link>
          </div>
        </div>
      </header>
      <main>
        <section className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-4xl font-bold mb-4">Motion Intelligence at Scale</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">IK/FK solving, 1000Hz-to-8-byte motion intent compression, and trajectory optimization. Built for robotics, VR, and prosthetics.</p>
          <Link href="/dashboard/console" className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90">Launch Console</Link>
        </section>
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f) => (
              <div key={f.title} className="border border-border rounded-lg p-6">
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <h3 className="text-xl font-semibold mb-4 text-center">Kinematic Chains</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {chains.map((c) => <span key={c} className="px-4 py-2 bg-muted rounded-full text-sm">{c}</span>)}
          </div>
        </section>
      </main>
    </div>
  );
}
