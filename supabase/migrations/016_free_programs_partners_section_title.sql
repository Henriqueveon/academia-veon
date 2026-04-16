-- ============================================================
-- Migration 016: Título editável da seção de sócios/fundadores
--
-- Permite ao gestor customizar livremente o título da seção
-- de sócios/fundadores que aparece na página pública do programa.
-- ============================================================

ALTER TABLE public.free_programs
  ADD COLUMN IF NOT EXISTS partners_section_title text;
