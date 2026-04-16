-- ============================================================
-- Migration 019: Texto editável do botão do formulário de lead
--
-- Permite ao gestor customizar o texto do botão de submit do
-- formulário (ex: "Desbloquear aulas", "Quero participar", etc).
-- ============================================================

ALTER TABLE public.free_programs
  ADD COLUMN IF NOT EXISTS form_button_text text;
