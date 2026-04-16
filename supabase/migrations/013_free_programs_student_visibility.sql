-- ============================================================
-- Migration 013: Visibilidade de programas para alunos
--
-- Permite ocultar programas educacionais do painel do aluno
-- mesmo estando publicados (ex: projetos internos).
-- ============================================================

ALTER TABLE public.free_programs
  ADD COLUMN IF NOT EXISTS visible_to_students boolean DEFAULT true;
