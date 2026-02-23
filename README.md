# ALICE Kinematics Cloud

Cloud-based kinematics engine — inverse/forward kinematics, motion intent compression, and trajectory optimization via REST API.

**License: AGPL-3.0**

---

## Architecture

```
                    ┌─────────────────┐
                    │   Browser / UI  │
                    │  Next.js :3000  │
                    └────────┬────────┘
                             │ HTTP
                    ┌────────▼────────┐
                    │   API Gateway   │
                    │     :8080       │
                    └────────┬────────┘
                             │ HTTP
                    ┌────────▼────────┐
                    │  Kinematics     │
                    │  Engine         │
                    │  Rust/Axum      │
                    │    :8081        │
                    └─────────────────┘
```

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Next.js dashboard |
| API Gateway | 8080 | Reverse proxy / auth |
| Kinematics Engine | 8081 | Rust/Axum core engine |

---

## API Endpoints

### POST /api/v1/kinematics/solve-ik

Solve inverse kinematics for a target position.

**Request:**
```json
{
  "target_position": [0.5, 0.3, 0.2],
  "target_orientation": [0, 0, 0, 1],
  "joint_count": 7,
  "constraints": {
    "max_iterations": 100,
    "tolerance": 1e-6
  }
}
```

**Response:**
```json
{
  "solution_id": "550e8400-...",
  "joint_angles": [0.1, -0.3, 0.5, 0.2, -0.1, 0.4, 0.0],
  "iterations": 42,
  "converged": true,
  "error_distance": 0.000001,
  "elapsed_us": 150
}
```

---

### POST /api/v1/kinematics/solve-fk

Compute forward kinematics from joint angles.

**Request:**
```json
{
  "joint_angles": [0.1, 0.2, 0.3, 0.4, 0.5],
  "link_lengths": [0.2, 0.2, 0.2, 0.2, 0.2]
}
```

---

### POST /api/v1/kinematics/compress-intent

Compress motion samples into a semantic intent representation.

**Request:**
```json
{
  "samples": [
    {"timestamp_ms": 0, "position": [0, 0, 0], "velocity": [1, 0, 0]},
    {"timestamp_ms": 100, "position": [0.1, 0, 0], "velocity": [1, 0, 0]}
  ],
  "sample_rate_hz": 1000
}
```

**Response:**
```json
{
  "intent_id": "...",
  "compressed_bytes": 8,
  "original_samples": 2,
  "compression_ratio": 6.0,
  "intent_type": "reach",
  "direction": [1.0, 0.0, 0.0],
  "magnitude": 0.1,
  "elapsed_us": 12
}
```

Intent types: `idle` | `grasp` | `release` | `traverse` | `reach`

---

### POST /api/v1/kinematics/optimize-trajectory

Optimize a trajectory through waypoints with velocity constraints.

**Request:**
```json
{
  "waypoints": [[0,0,0], [1,0,0], [1,1,0], [1,1,1]],
  "max_velocity": 1.0
}
```

---

### GET /api/v1/kinematics/chains

List available kinematic chain presets.

| Chain ID | DOF | Type | Description |
|----------|-----|------|-------------|
| human_arm | 7 | revolute | Shoulder(3) + elbow(1) + wrist(3) |
| human_leg | 6 | revolute | Hip(3) + knee(1) + ankle(2) |
| robotic_arm_6dof | 6 | revolute | Standard industrial manipulator |
| delta_robot | 3 | prismatic | High-speed pick-and-place |
| scara | 4 | revolute+prismatic | Selective compliance assembly |

---

### GET /api/v1/kinematics/stats

Engine statistics.

---

### GET /health

Health check endpoint.

---

## Quick Start

### Kinematics Engine (Rust)

```bash
cd services/core-engine
cargo build --release
KINEMATICS_ADDR=0.0.0.0:8081 ./target/release/kinematics-engine
```

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KINEMATICS_ADDR` | `0.0.0.0:8081` | Engine bind address |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | API base URL for frontend |

---

## License

AGPL-3.0 — See [LICENSE](LICENSE) for details.
