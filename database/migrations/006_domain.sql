-- Kinematics Cloud domain tables
create table if not exists public.kinematic_chains (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    name text not null,
    chain_type text not null default 'serial' check (chain_type in ('serial', 'parallel', 'tree', 'closed_loop')),
    joint_count integer not null,
    dof integer not null,
    joints jsonb not null default '[]',
    end_effector_count integer default 1,
    workspace_volume double precision,
    created_at timestamptz default now()
);
create table if not exists public.ik_solver_jobs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    chain_id uuid references public.kinematic_chains(id) on delete cascade,
    solver_type text not null default 'ccd' check (solver_type in ('ccd', 'fabrik', 'jacobian', 'analytical', 'hybrid')),
    target_position jsonb not null,
    target_orientation jsonb,
    status text default 'pending',
    iterations integer,
    residual_error double precision,
    solution jsonb,
    solve_time_ms double precision,
    created_at timestamptz default now()
);
create index idx_kinematic_chains_user on public.kinematic_chains(user_id);
create index idx_ik_solver_jobs_chain on public.ik_solver_jobs(chain_id);
create index idx_ik_solver_jobs_user on public.ik_solver_jobs(user_id);
