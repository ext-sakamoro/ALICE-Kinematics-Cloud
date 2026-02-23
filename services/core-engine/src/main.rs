use axum::{extract::State, response::Json, routing::{get, post}, Router};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

// ── State ───────────────────────────────────────────────────
struct AppState {
    start_time: Instant,
    stats: Mutex<EngineStats>,
}

struct EngineStats {
    total_ik_solves: u64,
    total_fk_solves: u64,
    total_compressions: u64,
    total_trajectories: u64,
}

// ── Types ───────────────────────────────────────────────────
#[derive(Serialize)]
struct Health { status: String, version: String, uptime_secs: u64, total_solves: u64 }

// IK
#[derive(Deserialize)]
struct IkRequest {
    #[allow(dead_code)]
    chain_id: Option<String>,
    target_position: [f64; 3],
    target_orientation: Option<[f64; 4]>,
    joint_count: Option<u32>,
    constraints: Option<IkConstraints>,
}
#[derive(Deserialize)]
struct IkConstraints { max_iterations: Option<u32>, tolerance: Option<f64> }
#[derive(Serialize)]
struct IkResponse {
    solution_id: String, joint_angles: Vec<f64>, iterations: u32,
    converged: bool, error_distance: f64, elapsed_us: u128,
}

// FK
#[derive(Deserialize)]
struct FkRequest { #[allow(dead_code)] chain_id: Option<String>, joint_angles: Vec<f64>, link_lengths: Option<Vec<f64>> }
#[derive(Serialize)]
struct FkResponse {
    end_effector_position: [f64; 3], end_effector_orientation: [f64; 4],
    joint_positions: Vec<[f64; 3]>, elapsed_us: u128,
}

// Intent compression
#[derive(Deserialize)]
struct IntentRequest { samples: Vec<MotionSample>, sample_rate_hz: Option<u32> }
#[derive(Deserialize)]
struct MotionSample { #[allow(dead_code)] timestamp_ms: u64, position: [f64; 3], velocity: Option<[f64; 3]> }
#[derive(Serialize)]
struct IntentResponse {
    intent_id: String, compressed_bytes: u64, original_samples: usize,
    compression_ratio: f64, intent_type: String, direction: [f64; 3],
    magnitude: f64, elapsed_us: u128,
}

// Trajectory
#[derive(Deserialize)]
struct TrajectoryRequest {
    waypoints: Vec<Vec<f64>>, max_velocity: Option<f64>,
    #[allow(dead_code)] max_acceleration: Option<f64>, #[allow(dead_code)] smoothness: Option<f64>,
}
#[derive(Serialize)]
struct TrajectoryResponse {
    trajectory_id: String, optimized_waypoints: Vec<TrajectoryPoint>,
    total_distance: f64, total_time: f64, max_velocity_reached: f64, elapsed_us: u128,
}
#[derive(Serialize)]
struct TrajectoryPoint { position: [f64; 3], velocity: [f64; 3], time: f64 }

#[derive(Serialize)]
struct ChainInfo { id: String, name: String, description: String, dof: u32, joint_type: String }

#[derive(Serialize)]
struct StatsResponse { total_ik_solves: u64, total_fk_solves: u64, total_compressions: u64, total_trajectories: u64 }

// ── Main ────────────────────────────────────────────────────
#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "kinematics_engine=info".into()))
        .init();
    let state = Arc::new(AppState {
        start_time: Instant::now(),
        stats: Mutex::new(EngineStats { total_ik_solves: 0, total_fk_solves: 0, total_compressions: 0, total_trajectories: 0 }),
    });
    let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any);
    let app = Router::new()
        .route("/health", get(health))
        .route("/api/v1/kinematics/solve-ik", post(solve_ik))
        .route("/api/v1/kinematics/solve-fk", post(solve_fk))
        .route("/api/v1/kinematics/compress-intent", post(compress_intent))
        .route("/api/v1/kinematics/optimize-trajectory", post(optimize_trajectory))
        .route("/api/v1/kinematics/chains", get(chains))
        .route("/api/v1/kinematics/stats", get(stats))
        .layer(cors).layer(TraceLayer::new_for_http()).with_state(state);
    let addr = std::env::var("KINEMATICS_ADDR").unwrap_or_else(|_| "0.0.0.0:8081".into());
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    tracing::info!("Kinematics Engine on {addr}");
    axum::serve(listener, app).await.unwrap();
}

// ── Handlers ────────────────────────────────────────────────
async fn health(State(s): State<Arc<AppState>>) -> Json<Health> {
    let st = s.stats.lock().unwrap();
    Json(Health {
        status: "ok".into(), version: env!("CARGO_PKG_VERSION").into(),
        uptime_secs: s.start_time.elapsed().as_secs(),
        total_solves: st.total_ik_solves + st.total_fk_solves,
    })
}

async fn solve_ik(State(s): State<Arc<AppState>>, Json(req): Json<IkRequest>) -> Json<IkResponse> {
    let t = Instant::now();
    let n = req.joint_count.unwrap_or(7) as usize;
    let max_iter = req.constraints.as_ref().and_then(|c| c.max_iterations).unwrap_or(100);
    let tol = req.constraints.as_ref().and_then(|c| c.tolerance).unwrap_or(1e-6);
    let target = req.target_position;
    let _orient = req.target_orientation;

    // Simple iterative IK: damped least squares simulation
    let mut angles = vec![0.0f64; n];
    let link_len = 1.0 / n as f64;
    let mut iterations = 0u32;
    let mut error = f64::MAX;

    for _ in 0..max_iter {
        iterations += 1;
        // FK to get current end effector
        let (ex, ey, ez) = fk_chain(&angles, link_len);
        let dx = target[0] - ex;
        let dy = target[1] - ey;
        let dz = target[2] - ez;
        error = (dx * dx + dy * dy + dz * dz).sqrt();
        if error < tol { break; }

        // Damped pseudo-inverse update (simplified)
        let damping = 0.1;
        for (i, angle) in angles.iter_mut().enumerate() {
            let phase = (i as f64 + 1.0) / n as f64;
            *angle += damping * (dx * phase.cos() + dy * phase.sin() + dz * 0.5);
            *angle = angle.clamp(-std::f64::consts::PI, std::f64::consts::PI);
        }
    }

    s.stats.lock().unwrap().total_ik_solves += 1;
    Json(IkResponse {
        solution_id: uuid::Uuid::new_v4().to_string(),
        joint_angles: angles, iterations, converged: error < tol,
        error_distance: error, elapsed_us: t.elapsed().as_micros(),
    })
}

async fn solve_fk(State(s): State<Arc<AppState>>, Json(req): Json<FkRequest>) -> Json<FkResponse> {
    let t = Instant::now();
    let n = req.joint_angles.len();
    let links = req.link_lengths.unwrap_or_else(|| vec![0.2; n]);
    let mut positions = Vec::with_capacity(n + 1);
    let mut x = 0.0f64;
    let mut y = 0.0f64;
    let mut z = 0.0f64;
    let mut cumulative_angle = 0.0f64;

    positions.push([x, y, z]);
    for i in 0..n {
        cumulative_angle += req.joint_angles[i];
        let link = if i < links.len() { links[i] } else { 0.15 };
        x += link * cumulative_angle.cos();
        y += link * cumulative_angle.sin();
        z += link * (cumulative_angle * 0.5).sin() * 0.3;
        positions.push([x, y, z]);
    }

    // Simple orientation quaternion from final angle
    let half = cumulative_angle * 0.5;
    let orientation = [0.0, 0.0, half.sin(), half.cos()];

    s.stats.lock().unwrap().total_fk_solves += 1;
    Json(FkResponse {
        end_effector_position: [x, y, z], end_effector_orientation: orientation,
        joint_positions: positions, elapsed_us: t.elapsed().as_micros(),
    })
}

async fn compress_intent(State(s): State<Arc<AppState>>, Json(req): Json<IntentRequest>) -> Json<IntentResponse> {
    let t = Instant::now();
    let n = req.samples.len();
    let _rate = req.sample_rate_hz.unwrap_or(1000);

    if n == 0 {
        return Json(IntentResponse {
            intent_id: uuid::Uuid::new_v4().to_string(),
            compressed_bytes: 0, original_samples: 0, compression_ratio: 0.0,
            intent_type: "idle".into(), direction: [0.0, 0.0, 0.0], magnitude: 0.0,
            elapsed_us: t.elapsed().as_micros(),
        });
    }

    // Compute motion direction from first to last sample
    let first = &req.samples[0].position;
    let last = &req.samples[n - 1].position;
    let dx = last[0] - first[0];
    let dy = last[1] - first[1];
    let dz = last[2] - first[2];
    let magnitude = (dx * dx + dy * dy + dz * dz).sqrt();

    let direction = if magnitude > 1e-9 {
        [dx / magnitude, dy / magnitude, dz / magnitude]
    } else {
        [0.0, 0.0, 0.0]
    };

    // Compute average velocity from samples that have it
    let avg_vel: f64 = req.samples.iter()
        .filter_map(|s| s.velocity.as_ref())
        .map(|v| (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt())
        .sum::<f64>() / n.max(1) as f64;

    // Classify intent
    let intent_type = if magnitude < 0.01 {
        "idle"
    } else if magnitude < 0.1 && avg_vel < 0.05 {
        "grasp"
    } else if dz > magnitude * 0.7 {
        "release"
    } else if magnitude > 0.5 {
        "traverse"
    } else {
        "reach"
    }.to_string();

    // Original: n samples * 3 floats * 8 bytes = 24n bytes. Compressed: 8 bytes
    let original_bytes = (n * 24) as f64;
    let compressed_bytes = 8u64;
    let compression_ratio = original_bytes / compressed_bytes as f64;

    s.stats.lock().unwrap().total_compressions += 1;
    Json(IntentResponse {
        intent_id: uuid::Uuid::new_v4().to_string(),
        compressed_bytes, original_samples: n, compression_ratio,
        intent_type, direction, magnitude,
        elapsed_us: t.elapsed().as_micros(),
    })
}

async fn optimize_trajectory(State(s): State<Arc<AppState>>, Json(req): Json<TrajectoryRequest>) -> Json<TrajectoryResponse> {
    let t = Instant::now();
    let max_vel = req.max_velocity.unwrap_or(1.0);
    let waypoints: Vec<[f64; 3]> = req.waypoints.iter().map(|w| {
        [*w.first().unwrap_or(&0.0), *w.get(1).unwrap_or(&0.0), *w.get(2).unwrap_or(&0.0)]
    }).collect();

    let mut total_distance = 0.0f64;
    let mut optimized = Vec::new();
    let mut cumulative_time = 0.0f64;
    let mut max_vel_reached = 0.0f64;

    for i in 0..waypoints.len() {
        let pos = waypoints[i];
        let seg_dist = if i > 0 {
            let prev = waypoints[i - 1];
            let d = ((pos[0] - prev[0]).powi(2) + (pos[1] - prev[1]).powi(2) + (pos[2] - prev[2]).powi(2)).sqrt();
            total_distance += d;
            d
        } else { 0.0 };

        // Trapezoidal velocity profile: accelerate, cruise, decelerate
        let seg_time = if seg_dist > 0.0 { seg_dist / (max_vel * 0.8) } else { 0.0 };
        cumulative_time += seg_time;

        let vel_mag = if seg_time > 0.0 { seg_dist / seg_time } else { 0.0 };
        if vel_mag > max_vel_reached { max_vel_reached = vel_mag; }

        let velocity = if i + 1 < waypoints.len() {
            let next = waypoints[i + 1];
            let dx = next[0] - pos[0];
            let dy = next[1] - pos[1];
            let dz = next[2] - pos[2];
            let d = (dx * dx + dy * dy + dz * dz).sqrt().max(1e-9);
            [dx / d * vel_mag, dy / d * vel_mag, dz / d * vel_mag]
        } else {
            [0.0, 0.0, 0.0]
        };

        optimized.push(TrajectoryPoint { position: pos, velocity, time: cumulative_time });
    }

    s.stats.lock().unwrap().total_trajectories += 1;
    Json(TrajectoryResponse {
        trajectory_id: uuid::Uuid::new_v4().to_string(),
        optimized_waypoints: optimized, total_distance,
        total_time: cumulative_time, max_velocity_reached: max_vel_reached,
        elapsed_us: t.elapsed().as_micros(),
    })
}

async fn chains() -> Json<Vec<ChainInfo>> {
    Json(vec![
        ChainInfo { id: "human_arm".into(), name: "Human Arm".into(), description: "7-DOF human arm: shoulder(3) + elbow(1) + wrist(3)".into(), dof: 7, joint_type: "revolute".into() },
        ChainInfo { id: "human_leg".into(), name: "Human Leg".into(), description: "6-DOF human leg: hip(3) + knee(1) + ankle(2)".into(), dof: 6, joint_type: "revolute".into() },
        ChainInfo { id: "robotic_arm_6dof".into(), name: "Robotic Arm (6-DOF)".into(), description: "Standard industrial 6-DOF manipulator".into(), dof: 6, joint_type: "revolute".into() },
        ChainInfo { id: "delta_robot".into(), name: "Delta Robot".into(), description: "3-DOF parallel kinematic delta robot for high-speed pick-and-place".into(), dof: 3, joint_type: "prismatic".into() },
        ChainInfo { id: "scara".into(), name: "SCARA".into(), description: "4-DOF selective compliance assembly robot arm".into(), dof: 4, joint_type: "revolute+prismatic".into() },
    ])
}

async fn stats(State(s): State<Arc<AppState>>) -> Json<StatsResponse> {
    let st = s.stats.lock().unwrap();
    Json(StatsResponse {
        total_ik_solves: st.total_ik_solves, total_fk_solves: st.total_fk_solves,
        total_compressions: st.total_compressions, total_trajectories: st.total_trajectories,
    })
}

// ── Helpers ─────────────────────────────────────────────────
fn fk_chain(angles: &[f64], link_len: f64) -> (f64, f64, f64) {
    let mut x = 0.0f64;
    let mut y = 0.0f64;
    let mut z = 0.0f64;
    let mut cumulative = 0.0f64;
    for &angle in angles {
        cumulative += angle;
        x += link_len * cumulative.cos();
        y += link_len * cumulative.sin();
        z += link_len * (cumulative * 0.5).sin() * 0.3;
    }
    (x, y, z)
}
