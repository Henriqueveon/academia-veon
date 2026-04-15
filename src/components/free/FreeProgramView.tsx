import { useState } from 'react'
import { Lock, Unlock, Target, Users, TrendingUp, PlayCircle } from 'lucide-react'
import { VideoPlayer } from '../VideoPlayer'

export interface FreeProgram {
  id: string
  slug: string
  title: string
  subtitle?: string | null
  episodes_badge?: string | null
  objective_title?: string | null
  objective_card1_text?: string | null
  objective_card2_text?: string | null
  objective_card3_text?: string | null
  partner1_name?: string | null
  partner1_role?: string | null
  partner1_bio?: string | null
  partner1_photo_url?: string | null
  partner2_name?: string | null
  partner2_role?: string | null
  partner2_bio?: string | null
  partner2_photo_url?: string | null
  cta_button_text?: string | null
  cta_button_url?: string | null
  webhook_url?: string | null
  published?: boolean
}

export interface FreeLesson {
  id: string
  title: string
  subtitle?: string | null
  bunny_video_id?: string | null
  bunny_library_id?: string | null
  sort_order: number
}

interface Props {
  program: FreeProgram
  lessons: FreeLesson[]
  unlocked: boolean
  onRequestUnlock: () => void
}

export function FreeProgramView({ program, lessons, unlocked, onRequestUnlock }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const active = lessons[activeIdx]
  const total = lessons.length

  const handleSelect = (idx: number) => {
    if (!unlocked) {
      onRequestUnlock()
      return
    }
    setActiveIdx(idx)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050D20] via-[#0A1733] to-[#1E3A5F] text-white">
      {/* Topo / logo */}
      <header className="w-full py-5 px-4 md:px-10 border-b border-white/5">
        {/* Desktop: logo à esquerda + "A Escola do Varejo" à direita */}
        <div className="hidden md:flex items-center justify-between gap-6">
          <img src="/veon-logo.png" alt="Instituto Veon" className="h-[110px] object-contain" />
          <img src="/escola-do-varejo.png" alt="A Escola do Varejo" className="h-10 lg:h-12 object-contain opacity-90" />
        </div>
        {/* Mobile: logo centralizada + faixa em movimento abaixo */}
        <div className="md:hidden flex flex-col items-center gap-3">
          <img src="/veon-logo.png" alt="Instituto Veon" className="h-[82px] object-contain" />
          <div className="w-full overflow-hidden">
            <div className="flex w-max animate-marquee-x">
              {Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  aria-hidden={i > 0}
                  className="px-6 text-sm font-semibold tracking-[0.2em] text-white/80 uppercase shrink-0"
                >
                  A Escola do Varejo
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-10 md:pt-14 pb-10">
        <h1 className="text-2xl md:text-4xl font-bold text-center text-white leading-tight">
          {program.title}
        </h1>
        {program.subtitle && (
          <p className="text-center text-[#B8C0D0] mt-3 md:text-lg max-w-3xl mx-auto">
            {program.subtitle}
          </p>
        )}

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Player */}
          <div className="relative">
            <div className="bg-[#0F1F42]/80 backdrop-blur-sm border border-[#E63946]/30 rounded-xl overflow-hidden">
              {active?.bunny_video_id ? (
                <div className="relative">
                  <VideoPlayer
                    videoId={active.bunny_video_id}
                    libraryId={active.bunny_library_id || undefined}
                  />
                  {!unlocked && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
                      onClick={onRequestUnlock}
                    >
                      <Lock className="w-14 h-14 text-[#E63946] mb-3" />
                      <p className="text-white font-semibold text-lg">Conteúdo bloqueado</p>
                      <p className="text-[#B8C0D0] text-sm mt-1">Clique para desbloquear suas aulas</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video flex items-center justify-center text-[#B8C0D0]">
                  <PlayCircle className="w-14 h-14 opacity-40" />
                </div>
              )}
            </div>
            {active && (
              <div className="mt-4">
                <h2 className="text-xl font-semibold text-white">{active.title}</h2>
                {active.subtitle && <p className="text-[#B8C0D0] text-sm mt-1">{active.subtitle}</p>}
              </div>
            )}
          </div>

          {/* Lista de aulas - estilo timeline */}
          <aside>
            <div className="flex items-center justify-end mb-3">
              <span className="text-xs bg-[#E63946] text-white px-2.5 py-1 rounded-full font-semibold">
                {program.episodes_badge || `${total} episódios`}
              </span>
            </div>
            <ul className="relative">
              {lessons.map((l, idx) => {
                const isActive = idx === activeIdx && unlocked
                const isLast = idx === lessons.length - 1
                return (
                  <li key={l.id} className="relative pb-4 last:pb-0">
                    {!isLast && (
                      <span
                        aria-hidden
                        className="absolute left-[22px] top-[52px] bottom-0 w-px bg-[#E63946]"
                      />
                    )}
                    <button
                      onClick={() => handleSelect(idx)}
                      className={`relative w-full text-left px-4 py-4 rounded-xl border-[1.5px] transition-colors flex items-start gap-3 ${
                        isActive
                          ? 'bg-[#0F1F42]/80 border-[#E63946]'
                          : 'bg-[#0F1F42]/60 border-white/10 hover:border-[#E63946]/60'
                      }`}
                    >
                      <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-[#0A1733] border border-white/10 flex items-center justify-center">
                        {unlocked ? (
                          <Unlock className="w-5 h-5 text-[#E63946]" />
                        ) : (
                          <Lock className="w-5 h-5 text-[#E63946]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-sm md:text-base font-semibold text-white leading-snug">
                          Aula {String(idx + 1).padStart(2, '0')}: {l.title}
                        </p>
                        {l.subtitle && (
                          <p className="text-xs text-[#B8C0D0] mt-1 leading-snug">{l.subtitle}</p>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
              {lessons.length === 0 && (
                <li className="text-sm text-[#B8C0D0] px-2 py-3">Nenhuma aula publicada ainda.</li>
              )}
            </ul>
          </aside>
        </div>
      </section>

      {/* Objetivo */}
      {(program.objective_title || program.objective_card1_text) && (
        <section className="max-w-6xl mx-auto px-4 md:px-8 py-12">
          {program.objective_title && (
            <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-10">
              {program.objective_title}
            </h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: Target, text: program.objective_card1_text },
              { icon: Users, text: program.objective_card2_text },
              { icon: TrendingUp, text: program.objective_card3_text },
            ].map((card, i) => {
              const Icon = card.icon
              if (!card.text) return null
              return (
                <div
                  key={i}
                  className="bg-[#0F1F42]/80 backdrop-blur-sm border-[1.5px] border-[#E63946] rounded-xl p-6 flex flex-col items-center text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-[#E63946] flex items-center justify-center mb-4">
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-[#B8C0D0] text-sm leading-relaxed">{card.text}</p>
                </div>
              )
            })}
          </div>
          {program.cta_button_text && program.cta_button_url && (
            <div className="flex justify-center mt-10">
              <a
                href={program.cta_button_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#E63946] hover:bg-[#c62f3b] text-white font-semibold px-8 py-3.5 rounded-lg transition-colors"
              >
                {program.cta_button_text}
              </a>
            </div>
          )}
        </section>
      )}

      {/* Sócios / Fundadores */}
      {(program.partner1_name || program.partner2_name) && (
        <section className="max-w-5xl mx-auto px-4 md:px-8 py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-10">
            Conheça os fundadores
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { name: program.partner1_name, role: program.partner1_role, bio: program.partner1_bio, photo: program.partner1_photo_url },
              { name: program.partner2_name, role: program.partner2_role, bio: program.partner2_bio, photo: program.partner2_photo_url },
            ].map((p, i) =>
              p.name ? (
                <div
                  key={i}
                  className="bg-[#0F1F42]/80 backdrop-blur-sm border-[1.5px] border-[#E63946] rounded-xl overflow-hidden flex flex-col"
                >
                  {p.photo ? (
                    <img
                      src={p.photo}
                      alt={p.name}
                      className="w-full aspect-[3/4] object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-[3/4] bg-[#0A1733] flex items-center justify-center text-[#B8C0D0]">
                      <Users className="w-16 h-16 opacity-40" />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="text-xl font-bold text-[#E63946]">{p.name}</h3>
                    {p.role && <p className="text-white font-medium mt-1">{p.role}</p>}
                    {p.bio && <p className="text-[#B8C0D0] text-sm mt-3 leading-relaxed">{p.bio}</p>}
                  </div>
                </div>
              ) : null,
            )}
          </div>
          {program.cta_button_text && program.cta_button_url && (
            <div className="flex justify-center mt-10">
              <a
                href={program.cta_button_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#E63946] hover:bg-[#c62f3b] text-white font-semibold px-8 py-3.5 rounded-lg transition-colors"
              >
                {program.cta_button_text}
              </a>
            </div>
          )}
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-6">
        <div className="flex flex-col items-center gap-3">
          <img src="/veon-logo.png" alt="Instituto Veon" className="h-[82px] object-contain" />
          <p className="text-xs text-[#B8C0D0]">© Instituto Veon</p>
        </div>
      </footer>
    </div>
  )
}
