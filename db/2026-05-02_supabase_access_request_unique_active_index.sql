create unique index if not exists access_requests_active_company_email_unique
  on public.access_requests (lower(company_name), lower(requester_email))
  where coalesce(status, 'NEW') in ('NEW', 'PENDING', 'IN_REVIEW');

create index if not exists access_requests_requester_email_created_at_idx
  on public.access_requests (lower(requester_email), created_at desc);
