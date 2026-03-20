import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Play, X, Maximize, Minimize, Gauge } from 'lucide-react'

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/)
  return match ? match[1] : null
}

export function ModulesPage() {
  const queryClient = useQueryClient()
  const [showModuleForm, setShowModuleForm] = useState(false)
  const [editingModule, setEditingModule] = useState<any>(null)
  const [moduleForm, setModuleForm] = useState({ title: '', description: '', thumbnail_url: '', sort_order: 0 })
  const [expandedModule, setExpandedModule] = useState<string | null>(null)
  const [editingLesson, setEditingLesson] = useState<any>(null)
  const [lessonForm, setLessonForm] = useState({ title: '', description: '', youtube_url: '', sort_order: 0 })
  const [selectedLesson, setSelectedLesson] = useState<any>(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  // Fetch modules
  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['gestor-modules'],
    queryFn: async () => {
      const { data } = await supabase.from('modules').select('*').order('sort_order')
      return data || []
    },
  })

  // Fetch all lessons
  const { data: lessons = [] } = useQuery({
    queryKey: ['gestor-lessons'],
    queryFn: async () => {
      const { data } = await supabase.from('lessons').select('*').order('sort_order')
      return data || []
    },
  })

  // Module mutations
  const saveModule = useMutation({
    mutationFn: async () => {
      if (editingModule) {
        await supabase.from('modules').update({
          title: moduleForm.title,
          description: moduleForm.description || null,
          thumbnail_url: moduleForm.thumbnail_url || null,
          sort_order: moduleForm.sort_order,
        }).eq('id', editingModule.id)
      } else {
        await supabase.from('modules').insert({
          title: moduleForm.title,
          description: moduleForm.description || null,
          thumbnail_url: moduleForm.thumbnail_url || null,
          sort_order: moduleForm.sort_order,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-modules'] })
      resetModuleForm()
    },
  })

  const deleteModule = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('modules').delete().eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gestor-modules'] }),
  })

  // Lesson mutations
  const saveLesson = useMutation({
    mutationFn: async (moduleId: string) => {
      if (editingLesson) {
        await supabase.from('lessons').update({
          title: lessonForm.title,
          description: lessonForm.description || null,
          youtube_url: lessonForm.youtube_url,
          sort_order: lessonForm.sort_order,
        }).eq('id', editingLesson.id)
      } else {
        await supabase.from('lessons').insert({
          module_id: moduleId,
          title: lessonForm.title,
          description: lessonForm.description || null,
          youtube_url: lessonForm.youtube_url,
          sort_order: lessonForm.sort_order,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-lessons'] })
      resetLessonForm()
    },
  })

  const deleteLesson = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('lessons').delete().eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gestor-lessons'] }),
  })

  function resetModuleForm() {
    setModuleForm({ title: '', description: '', thumbnail_url: '', sort_order: 0 })
    setEditingModule(null)
    setShowModuleForm(false)
  }

  function resetLessonForm() {
    setLessonForm({ title: '', description: '', youtube_url: '', sort_order: 0 })
    setEditingLesson(null)
    setEditingLesson(null)
  }

  function startEditModule(mod: any) {
    setModuleForm({
      title: mod.title,
      description: mod.description || '',
      thumbnail_url: mod.thumbnail_url || '',
      sort_order: mod.sort_order,
    })
    setEditingModule(mod)
    setShowModuleForm(true)
  }

  function startEditLesson(lesson: any) {
    setLessonForm({
      title: lesson.title,
      description: lesson.description || '',
      youtube_url: lesson.youtube_url,
      sort_order: lesson.sort_order,
    })
    setEditingLesson(lesson)
    setExpandedModule(null)
  }

  function scrollContainer(id: string, direction: 'left' | 'right') {
    const el = document.getElementById(id)
    if (el) el.scrollBy({ left: direction === 'left' ? -320 : 320, behavior: 'smooth' })
  }

  function getLessonsForModule(moduleId: string) {
    return lessons.filter((l: any) => l.module_id === moduleId)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Módulos</h1>
        <button
          onClick={() => { resetModuleForm(); setShowModuleForm(true) }}
          className="flex items-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Módulo
        </button>
      </div>

      {/* Module Form */}
      {showModuleForm && (
        <div className="bg-bg-card border border-navy-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">{editingModule ? 'Editar Módulo' : 'Novo Módulo'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Título *</label>
              <input
                value={moduleForm.title}
                onChange={(e) => setModuleForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                placeholder="Nome do módulo"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Ordem</label>
              <input
                type="number"
                value={moduleForm.sort_order}
                onChange={(e) => setModuleForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-text-secondary mb-1">Descrição</label>
              <textarea
                value={moduleForm.description}
                onChange={(e) => setModuleForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                rows={2}
                placeholder="Descrição do módulo"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-text-secondary mb-1">URL da Thumbnail</label>
              <input
                value={moduleForm.thumbnail_url}
                onChange={(e) => setModuleForm(f => ({ ...f, thumbnail_url: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => saveModule.mutate()}
              disabled={!moduleForm.title || saveModule.isPending}
              className="bg-red-veon hover:bg-red-veon-dark text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {saveModule.isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={resetModuleForm} className="bg-bg-input text-text-secondary hover:text-text-primary px-6 py-2 rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modules Netflix-style */}
      {modules.length === 0 ? (
        <p className="text-center text-text-muted py-20">Nenhum módulo criado ainda.</p>
      ) : (
        <div className="space-y-10">
          {modules.map((mod: any) => {
            const modLessons = getLessonsForModule(mod.id)
            const isExpanded = expandedModule === mod.id

            return (
              <div key={mod.id}>
                {/* Module header */}
                <div className="flex items-center gap-4 mb-4">
                  <h2 className="text-xl font-semibold text-text-primary">{mod.title}</h2>
                  <span className="text-xs text-text-muted bg-bg-card px-2 py-1 rounded">
                    {modLessons.length} aula(s)
                  </span>
                  <div className="flex gap-1 ml-auto">
                    <button
                      onClick={() => {
                        setExpandedModule(isExpanded ? null : mod.id)
                        resetLessonForm()
                      }}
                      className="text-xs bg-navy-800 hover:bg-navy-700 text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {isExpanded ? 'Fechar' : '+ Aula'}
                    </button>
                    <button onClick={() => startEditModule(mod)} className="p-1.5 text-text-muted hover:text-text-primary transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm('Excluir este módulo e todas as aulas?')) deleteModule.mutate(mod.id) }}
                      className="p-1.5 text-text-muted hover:text-red-veon transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {mod.description && (
                  <p className="text-sm text-text-secondary mb-4">{mod.description}</p>
                )}

                {/* Lesson form (inside expanded module) */}
                {isExpanded && (
                  <div className="bg-bg-card border border-navy-800 rounded-xl p-5 mb-4">
                    <h3 className="text-sm font-semibold mb-3">{editingLesson ? 'Editar Aula' : 'Nova Aula'}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-text-secondary mb-1">Título *</label>
                        <input
                          value={lessonForm.title}
                          onChange={(e) => setLessonForm(f => ({ ...f, title: e.target.value }))}
                          className="w-full bg-bg-input border border-navy-700 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-veon"
                          placeholder="Título da aula"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-secondary mb-1">URL do YouTube *</label>
                        <input
                          value={lessonForm.youtube_url}
                          onChange={(e) => setLessonForm(f => ({ ...f, youtube_url: e.target.value }))}
                          className="w-full bg-bg-input border border-navy-700 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-veon"
                          placeholder="https://youtube.com/watch?v=..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-secondary mb-1">Descrição</label>
                        <input
                          value={lessonForm.description}
                          onChange={(e) => setLessonForm(f => ({ ...f, description: e.target.value }))}
                          className="w-full bg-bg-input border border-navy-700 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-veon"
                          placeholder="Descrição breve"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-secondary mb-1">Ordem</label>
                        <input
                          type="number"
                          value={lessonForm.sort_order}
                          onChange={(e) => setLessonForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                          className="w-full bg-bg-input border border-navy-700 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-veon"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={() => saveLesson.mutate(mod.id)}
                        disabled={!lessonForm.title || !lessonForm.youtube_url || saveLesson.isPending}
                        className="bg-red-veon hover:bg-red-veon-dark text-white text-sm px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {saveLesson.isPending ? 'Salvando...' : 'Salvar Aula'}
                      </button>
                      {editingLesson && (
                        <button onClick={resetLessonForm} className="text-sm text-text-muted hover:text-text-primary">
                          Cancelar edição
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Lessons row - Netflix style */}
                {modLessons.length > 0 ? (
                  <div className="relative group">
                    <button
                      onClick={() => scrollContainer(`mod-${mod.id}`, 'left')}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-bg-primary/80 hover:bg-bg-card p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => scrollContainer(`mod-${mod.id}`, 'right')}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-bg-primary/80 hover:bg-bg-card p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    <div
                      id={`mod-${mod.id}`}
                      className="flex gap-4 overflow-x-auto pb-4"
                      style={{ scrollbarWidth: 'none' }}
                    >
                      {modLessons.map((lesson: any) => {
                        const videoId = extractYoutubeId(lesson.youtube_url)
                        const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null

                        return (
                          <div key={lesson.id} className="flex-shrink-0 w-72 bg-bg-card border border-navy-800 rounded-xl overflow-hidden hover:border-navy-600 transition-colors group/card">
                            <div className="relative cursor-pointer" onClick={() => { setSelectedLesson(lesson); setPlaybackSpeed(1) }}>
                              {thumbnail ? (
                                <img src={thumbnail} alt={lesson.title} className="w-full h-40 object-cover" />
                              ) : (
                                <div className="w-full h-40 bg-navy-900 flex items-center justify-center">
                                  <Play className="w-10 h-10 text-text-muted" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
                                <Play className="w-12 h-12 text-white" fill="white" />
                              </div>
                            </div>
                            <div className="p-3">
                              <h4 className="text-sm font-medium text-text-primary line-clamp-2">{lesson.title}</h4>
                              {lesson.description && (
                                <p className="text-xs text-text-muted mt-1 line-clamp-1">{lesson.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-text-muted">Ordem: {lesson.sort_order}</span>
                                <div className="ml-auto flex gap-1">
                                  <button
                                    onClick={() => { setExpandedModule(mod.id); startEditLesson(lesson) }}
                                    className="p-1 text-text-muted hover:text-text-primary transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => { if (confirm('Excluir esta aula?')) deleteLesson.mutate(lesson.id) }}
                                    className="p-1 text-text-muted hover:text-red-veon transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-text-muted py-4">Nenhuma aula neste módulo. Clique em "+ Aula" para adicionar.</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Video Modal */}
      {selectedLesson && (
        <VideoModal
          lesson={selectedLesson}
          playbackSpeed={playbackSpeed}
          onSpeedChange={setPlaybackSpeed}
          onClose={() => setSelectedLesson(null)}
        />
      )}
    </div>
  )
}

function VideoModal({
  lesson,
  playbackSpeed,
  onSpeedChange,
  onClose,
}: {
  lesson: any
  playbackSpeed: number
  onSpeedChange: (speed: number) => void
  onClose: () => void
}) {
  const videoId = extractYoutubeId(lesson.youtube_url)
  const playerRef = useRef<any>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const speeds = [1, 1.25, 1.5]

  useEffect(() => {
    if (!videoId) return

    if (!(window as any).YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }

    function createPlayer() {
      playerRef.current = new (window as any).YT.Player('yt-player', {
        videoId,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: (event: any) => {
            event.target.setPlaybackRate(playbackSpeed)
          },
        },
      })
    }

    if ((window as any).YT && (window as any).YT.Player) {
      createPlayer()
    } else {
      (window as any).onYouTubeIframeAPIReady = createPlayer
    }

    return () => {
      if (playerRef.current?.destroy) playerRef.current.destroy()
    }
  }, [videoId])

  useEffect(() => {
    if (playerRef.current?.setPlaybackRate) {
      playerRef.current.setPlaybackRate(playbackSpeed)
    }
  }, [playbackSpeed])

  // ESC to exit fullscreen
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isFullscreen, onClose])

  return (
    <div
      className={`fixed inset-0 z-[100] bg-black flex flex-col ${isFullscreen ? '' : 'bg-black/90 p-4 justify-center items-center'}`}
      onClick={isFullscreen ? undefined : onClose}
    >
      <div
        className={`${isFullscreen ? 'w-full h-full flex flex-col' : 'w-full max-w-5xl'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar - always visible */}
        <div className={`flex items-center justify-between ${isFullscreen ? 'px-6 py-3 bg-black/80' : 'mb-4'}`}>
          <div className="min-w-0">
            <h2 className={`font-semibold text-text-primary truncate ${isFullscreen ? 'text-base' : 'text-lg'}`}>{lesson.title}</h2>
            {!isFullscreen && lesson.description && (
              <p className="text-sm text-text-secondary mt-1">{lesson.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3 ml-4 flex-shrink-0">
            {/* Speed controls */}
            <div className="flex items-center gap-1">
              <Gauge className="w-4 h-4 text-text-muted" />
              {speeds.map((speed) => (
                <button
                  key={speed}
                  onClick={() => onSpeedChange(speed)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                    playbackSpeed === speed
                      ? 'bg-red-veon text-white'
                      : 'bg-bg-card/80 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            {/* Fullscreen toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center gap-1.5 text-xs bg-bg-card/80 text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg transition-colors"
            >
              {isFullscreen ? (
                <><Minimize className="w-4 h-4" /> Sair</>
              ) : (
                <><Maximize className="w-4 h-4" /> Tela cheia</>
              )}
            </button>

            {/* Close */}
            <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video */}
        {videoId ? (
          <div className={`relative bg-black ${isFullscreen ? 'flex-1' : 'w-full rounded-xl overflow-hidden'}`} style={isFullscreen ? {} : { paddingBottom: '56.25%' }}>
            <div id="yt-player" className={`${isFullscreen ? 'w-full h-full' : 'absolute inset-0 w-full h-full'}`} />
          </div>
        ) : (
          <div className="bg-bg-card rounded-xl p-20 text-center text-text-muted">
            URL do vídeo inválida
          </div>
        )}
      </div>
    </div>
  )
}
