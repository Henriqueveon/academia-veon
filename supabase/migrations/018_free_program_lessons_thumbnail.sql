-- ============================================================
-- Migration 018: Thumbnail/capa para aulas de programas
--
-- Permite ao gestor adicionar uma imagem de capa para cada aula.
-- ============================================================

ALTER TABLE public.free_program_lessons
  ADD COLUMN IF NOT EXISTS thumbnail_url text;
