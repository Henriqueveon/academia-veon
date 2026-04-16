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
      free_programs: {
        Row: {
          id: string
          slug: string
          title: string
          subtitle: string | null
          episodes_badge: string | null
          objective_title: string | null
          objective_card1_text: string | null
          objective_card2_text: string | null
          objective_card3_text: string | null
          partners_section_title: string | null
          partner1_name: string | null
          partner1_role: string | null
          partner1_bio: string | null
          partner1_photo_url: string | null
          partner2_name: string | null
          partner2_role: string | null
          partner2_bio: string | null
          partner2_photo_url: string | null
          cta_button_text: string | null
          cta_button_url: string | null
          cta_requires_form: boolean
          form_button_text: string | null
          webhook_url: string | null
          published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          subtitle?: string | null
          episodes_badge?: string | null
          objective_title?: string | null
          objective_card1_text?: string | null
          objective_card2_text?: string | null
          objective_card3_text?: string | null
          partners_section_title?: string | null
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
          cta_requires_form?: boolean
          form_button_text?: string | null
          webhook_url?: string | null
          published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['free_programs']['Insert']>
      }
      free_program_lessons: {
        Row: {
          id: string
          program_id: string
          title: string
          subtitle: string | null
          bunny_video_id: string | null
          bunny_library_id: string | null
          thumbnail_url: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          program_id: string
          title: string
          subtitle?: string | null
          bunny_video_id?: string | null
          bunny_library_id?: string | null
          thumbnail_url?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['free_program_lessons']['Insert']>
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
export type FreeProgram = Database['public']['Tables']['free_programs']['Row']
export type FreeProgramLesson = Database['public']['Tables']['free_program_lessons']['Row']
