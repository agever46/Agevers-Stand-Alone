-- Create seo_articles table
create table public.seo_articles (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    slug text not null unique,
    content text not null,
    excerpt text,
    status text not null default 'draft' check (status in ('draft', 'published')),
    image_url text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- RLS
alter table public.seo_articles enable row level security;

-- Grants
grant select on public.seo_articles to anon;
grant select on public.seo_articles to authenticated;
grant all on public.seo_articles to service_role;
grant all on public.seo_articles to authenticated;

-- Policies
create policy "Public read for published articles"
on public.seo_articles
for select
to anon, authenticated
using (status = 'published');

create policy "Admins can do everything on seo_articles"
on public.seo_articles
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
create or replace function public.handle_seo_articles_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger on_seo_articles_updated
    before update on public.seo_articles
    for each row
    execute function public.handle_seo_articles_updated_at();
