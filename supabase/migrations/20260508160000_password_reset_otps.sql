create table if not exists public.password_reset_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_otps_email on public.password_reset_otps (email, created_at desc);

alter table public.password_reset_otps enable row level security;
