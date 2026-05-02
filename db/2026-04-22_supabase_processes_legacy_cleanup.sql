-- Remove the final legacy compatibility path based on projects.current_revision_id.
-- Safe scope:
-- - `public.processes` view has no detected SQL dependents
-- - `projects.current_revision_id` is present but unused in live data

drop view if exists public.processes;

alter table if exists public.projects
  drop column if exists current_revision_id;
