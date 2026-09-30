-- Adds analytics/cost columns to curator_logs. Run once in the Supabase dashboard:
-- SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- The Edge Function works with or without these columns (it falls back to the four
-- original ones), so this can be run any time after deploying.
alter table public.curator_logs
  add column if not exists session_id     text,      -- one visitor's page load, groups a conversation
  add column if not exists page           text,      -- path the question was asked from, e.g. /works/yeon-gyeol-53
  add column if not exists work_id        integer,   -- artwork id parsed from that path, if any
  add column if not exists model          text,      -- which Gemini model actually answered
  add column if not exists prompt_tokens  integer,
  add column if not exists output_tokens  integer,
  add column if not exists thought_tokens integer,   -- "thinking" tokens, billed like output
  add column if not exists cached_tokens  integer;   -- part of prompt_tokens served from Gemini's cache (~90% cheaper)
