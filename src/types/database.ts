export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          role: 'tripulante' | 'gestor'
          created_at: string
        }
        Insert: {
          id: string
          name: string
          role?: 'tripulante' | 'gestor'
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          role?: 'tripulante' | 'gestor'
          created_at?: string
        }
      }
      groups: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      user_groups: {
        Row: {
          user_id: string
          group_id: string
        }
        Insert: {
          user_id: string
          group_id: string
        }
        Update: {
          user_id?: string
          group_id?: string
        }
      }
      modules: {
        Row: {
          id: string
          title: string
          description: string | null
          thumbnail_url: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          thumbnail_url?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          thumbnail_url?: string | null
          sort_order?: number
          created_at?: string
        }
      }
      module_groups: {
        Row: {
          module_id: string
          group_id: string
        }
        Insert: {
          module_id: string
          group_id: string
        }
        Update: {
          module_id?: string
          group_id?: string
        }
      }
      lessons: {
        Row: {
          id: string
          module_id: string
          title: string
          description: string | null
          youtube_url: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          module_id: string
          title: string
          description?: string | null
          youtube_url: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          module_id?: string
          title?: string
          description?: string | null
          youtube_url?: string
          sort_order?: number
          created_at?: string
        }
      }
      lesson_progress: {
        Row: {
          user_id: string
          lesson_id: string
          watched: boolean
          watched_at: string | null
        }
        Insert: {
          user_id: string
          lesson_id: string
          watched?: boolean
          watched_at?: string | null
        }
        Update: {
          user_id?: string
          lesson_id?: string
          watched?: boolean
          watched_at?: string | null
        }
      }
    }
  }
}

export interface RegistrationLink {
  id: string
  slug: string
  group_id: string
  description: string | null
  active: boolean
  created_by: string | null
  created_at: string
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Group = Database['public']['Tables']['groups']['Row']
export type Module = Database['public']['Tables']['modules']['Row']
export type Lesson = Database['public']['Tables']['lessons']['Row']
export type LessonProgress = Database['public']['Tables']['lesson_progress']['Row']
