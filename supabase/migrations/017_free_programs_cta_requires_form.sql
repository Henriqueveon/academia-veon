-- ============================================================
-- Migration 017: Exigir formulário no botão CTA
--
-- Permite ao gestor ativar/desativar preenchimento de formulário
-- antes do redirecionamento pelo botão CTA.
-- ============================================================

ALTER TABLE public.free_programs
  ADD COLUMN IF NOT EXISTS cta_requires_form boolean DEFAULT false;
