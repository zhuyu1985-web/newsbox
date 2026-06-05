export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_outputs: {
        Row: {
          created_at: string | null
          deepfake_warning: Json | null
          id: string
          journalist_view: Json | null
          key_questions: Json
          model_name: string | null
          model_version: string | null
          note_id: string
          provider: string | null
          summary: string
          timeline: Json | null
          transcript: string | null
          updated_at: string | null
          user_id: string
          visual_summary: Json | null
        }
        Insert: {
          created_at?: string | null
          deepfake_warning?: Json | null
          id?: string
          journalist_view?: Json | null
          key_questions?: Json
          model_name?: string | null
          model_version?: string | null
          note_id: string
          provider?: string | null
          summary: string
          timeline?: Json | null
          transcript?: string | null
          updated_at?: string | null
          user_id: string
          visual_summary?: Json | null
        }
        Update: {
          created_at?: string | null
          deepfake_warning?: Json | null
          id?: string
          journalist_view?: Json | null
          key_questions?: Json
          model_name?: string | null
          model_version?: string | null
          note_id?: string
          provider?: string | null
          summary?: string
          timeline?: Json | null
          transcript?: string | null
          updated_at?: string | null
          user_id?: string
          visual_summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_outputs_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: true
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_snapshot_renders: {
        Row: {
          bucket: string
          content_type: string
          created_at: string | null
          height: number
          id: string
          note_id: string
          object_path: string
          snapshot_id: string
          template: string
          user_id: string
          width: number
        }
        Insert: {
          bucket: string
          content_type?: string
          created_at?: string | null
          height?: number
          id?: string
          note_id: string
          object_path: string
          snapshot_id: string
          template: string
          user_id: string
          width?: number
        }
        Update: {
          bucket?: string
          content_type?: string
          created_at?: string | null
          height?: number
          id?: string
          note_id?: string
          object_path?: string
          snapshot_id?: string
          template?: string
          user_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_snapshot_renders_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_snapshot_renders_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "ai_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_snapshots: {
        Row: {
          card_data: Json | null
          content_hash: string
          created_at: string | null
          error_message: string | null
          id: string
          model_name: string | null
          model_provider: string | null
          model_version: string | null
          note_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_data?: Json | null
          content_hash: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          model_name?: string | null
          model_provider?: string | null
          model_version?: string | null
          note_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_data?: Json | null
          content_hash?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          model_name?: string | null
          model_provider?: string | null
          model_version?: string | null
          note_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_snapshots_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      annotations: {
        Row: {
          content: string
          created_at: string | null
          highlight_id: string | null
          id: string
          is_floating: boolean | null
          note_id: string
          screenshot_url: string | null
          timecode: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          highlight_id?: string | null
          id?: string
          is_floating?: boolean | null
          note_id: string
          screenshot_url?: string | null
          timecode?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          highlight_id?: string | null
          id?: string
          is_floating?: boolean | null
          note_id?: string
          screenshot_url?: string | null
          timecode?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotations_highlight_id_fkey"
            columns: ["highlight_id"]
            isOneToOne: false
            referencedRelation: "highlights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          last_accessed_at: string | null
          name: string
          parent_id: string | null
          position: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          last_accessed_at?: string | null
          name: string
          parent_id?: string | null
          position?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          last_accessed_at?: string | null
          name?: string
          parent_id?: string | null
          position?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_fk"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      highlights: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          note_id: string
          quote: string
          range_data: Json | null
          range_end: number | null
          range_start: number | null
          screenshot_url: string | null
          timecode: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          note_id: string
          quote: string
          range_data?: Json | null
          range_end?: number | null
          range_start?: number | null
          screenshot_url?: string | null
          timecode?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          note_id?: string
          quote?: string
          range_data?: Json | null
          range_end?: number | null
          range_start?: number | null
          screenshot_url?: string | null
          timecode?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "highlights_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          pinned: boolean
          pinned_at: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          pinned?: boolean
          pinned_at?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          pinned?: boolean
          pinned_at?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      knowledge_entities: {
        Row: {
          aliases: string[] | null
          avatar_url: string | null
          created_at: string | null
          description: string | null
          id: string
          metadata: Json
          name: string
          type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aliases?: string[] | null
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aliases?: string[] | null
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      knowledge_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          rating: number | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string | null
          id?: string
          rating?: number | null
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          rating?: number | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "knowledge_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_note_embeddings: {
        Row: {
          content_hash: string
          created_at: string | null
          embedding: Json
          model: string
          note_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content_hash: string
          created_at?: string | null
          embedding: Json
          model: string
          note_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content_hash?: string
          created_at?: string | null
          embedding?: Json
          model?: string
          note_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_note_embeddings_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: true
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_note_entities: {
        Row: {
          created_at: string | null
          entity_id: string
          id: string
          mention_count: number | null
          note_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          id?: string
          mention_count?: number | null
          note_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          id?: string
          mention_count?: number | null
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_note_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_note_entities_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_relationships: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          evidence_snippet: string | null
          id: string
          metadata: Json
          relation: string
          source_entity_id: string
          source_note_id: string | null
          target_entity_id: string
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          evidence_snippet?: string | null
          id?: string
          metadata?: Json
          relation: string
          source_entity_id: string
          source_note_id?: string | null
          target_entity_id: string
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          evidence_snippet?: string | null
          id?: string
          metadata?: Json
          relation?: string
          source_entity_id?: string
          source_note_id?: string | null
          target_entity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_relationships_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_relationships_source_note_id_fkey"
            columns: ["source_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_relationships_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "knowledge_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_topic_events: {
        Row: {
          created_at: string | null
          event_time: string
          fingerprint: string
          id: string
          importance: number
          source: Json
          summary: string | null
          title: string | null
          topic_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_time: string
          fingerprint: string
          id?: string
          importance?: number
          source?: Json
          summary?: string | null
          title?: string | null
          topic_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_time?: string
          fingerprint?: string
          id?: string
          importance?: number
          source?: Json
          summary?: string | null
          title?: string | null
          topic_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_topic_events_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "knowledge_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_topic_members: {
        Row: {
          created_at: string | null
          event_fingerprint: string | null
          event_time: string | null
          evidence_rank: number | null
          manual_state: string | null
          note_id: string
          score: number | null
          source: string
          topic_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_fingerprint?: string | null
          event_time?: string | null
          evidence_rank?: number | null
          manual_state?: string | null
          note_id: string
          score?: number | null
          source?: string
          topic_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_fingerprint?: string | null
          event_time?: string | null
          evidence_rank?: number | null
          manual_state?: string | null
          note_id?: string
          score?: number | null
          source?: string
          topic_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_topic_members_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_topic_members_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "knowledge_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_topics: {
        Row: {
          archived: boolean
          archived_at: string | null
          config: Json
          cover_image_url: string | null
          created_at: string | null
          id: string
          keywords: string[]
          last_ingested_at: string | null
          member_count: number
          pinned: boolean
          pinned_at: string | null
          stats: Json
          summary_markdown: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          config?: Json
          cover_image_url?: string | null
          created_at?: string | null
          id?: string
          keywords?: string[]
          last_ingested_at?: string | null
          member_count?: number
          pinned?: boolean
          pinned_at?: string | null
          stats?: Json
          summary_markdown?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          config?: Json
          cover_image_url?: string | null
          created_at?: string | null
          id?: string
          keywords?: string[]
          last_ingested_at?: string | null
          member_count?: number
          pinned?: boolean
          pinned_at?: string | null
          stats?: Json
          summary_markdown?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      note_tags: {
        Row: {
          created_at: string | null
          note_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          note_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          note_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_tags_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      note_visit_events: {
        Row: {
          content_type: Database["public"]["Enums"]["content_type"] | null
          id: string
          note_id: string | null
          site_name: string | null
          source: string
          source_domain: string | null
          source_url: string | null
          user_id: string
          visited_at: string
        }
        Insert: {
          content_type?: Database["public"]["Enums"]["content_type"] | null
          id?: string
          note_id?: string | null
          site_name?: string | null
          source?: string
          source_domain?: string | null
          source_url?: string | null
          user_id: string
          visited_at?: string
        }
        Update: {
          content_type?: Database["public"]["Enums"]["content_type"] | null
          id?: string
          note_id?: string | null
          site_name?: string | null
          source?: string
          source_domain?: string | null
          source_url?: string | null
          user_id?: string
          visited_at?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          archived_at: string | null
          author: string | null
          captured_at: string | null
          content_html: string | null
          content_text: string | null
          content_type: Database["public"]["Enums"]["content_type"]
          cover_image_url: string | null
          created_at: string | null
          deleted_at: string | null
          estimated_read_time: number | null
          excerpt: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          folder_id: string | null
          id: string
          is_starred: boolean
          last_accessed_at: string | null
          media_duration: number | null
          media_url: string | null
          published_at: string | null
          read_percentage: number | null
          reader_preferences: Json | null
          reading_position: number | null
          site_name: string | null
          source_type: Database["public"]["Enums"]["note_source_type"]
          source_url: string | null
          status: Database["public"]["Enums"]["note_status"] | null
          title: string | null
          updated_at: string | null
          user_id: string
          user_notes: Json | null
          user_notes_updated_at: string | null
          video_job_id: string | null
          video_overall_status: string | null
          video_ready_at: string | null
        }
        Insert: {
          archived_at?: string | null
          author?: string | null
          captured_at?: string | null
          content_html?: string | null
          content_text?: string | null
          content_type?: Database["public"]["Enums"]["content_type"]
          cover_image_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          estimated_read_time?: number | null
          excerpt?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          folder_id?: string | null
          id?: string
          is_starred?: boolean
          last_accessed_at?: string | null
          media_duration?: number | null
          media_url?: string | null
          published_at?: string | null
          read_percentage?: number | null
          reader_preferences?: Json | null
          reading_position?: number | null
          site_name?: string | null
          source_type?: Database["public"]["Enums"]["note_source_type"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["note_status"] | null
          title?: string | null
          updated_at?: string | null
          user_id: string
          user_notes?: Json | null
          user_notes_updated_at?: string | null
          video_job_id?: string | null
          video_overall_status?: string | null
          video_ready_at?: string | null
        }
        Update: {
          archived_at?: string | null
          author?: string | null
          captured_at?: string | null
          content_html?: string | null
          content_text?: string | null
          content_type?: Database["public"]["Enums"]["content_type"]
          cover_image_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          estimated_read_time?: number | null
          excerpt?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          folder_id?: string | null
          id?: string
          is_starred?: boolean
          last_accessed_at?: string | null
          media_duration?: number | null
          media_url?: string | null
          published_at?: string | null
          read_percentage?: number | null
          reader_preferences?: Json | null
          reading_position?: number | null
          site_name?: string | null
          source_type?: Database["public"]["Enums"]["note_source_type"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["note_status"] | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
          user_notes?: Json | null
          user_notes_updated_at?: string | null
          video_job_id?: string | null
          video_overall_status?: string | null
          video_ready_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_video_job_id_fkey"
            columns: ["video_job_id"]
            isOneToOne: false
            referencedRelation: "video_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          external_login_id: string | null
          external_source: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          external_login_id?: string | null
          external_source?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          external_login_id?: string | null
          external_source?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      quote_materials: {
        Row: {
          annotation_id: string | null
          content: string
          content_hash: string | null
          created_at: string | null
          highlight_id: string | null
          id: string
          note_id: string
          source_meta: Json | null
          source_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          annotation_id?: string | null
          content: string
          content_hash?: string | null
          created_at?: string | null
          highlight_id?: string | null
          id?: string
          note_id: string
          source_meta?: Json | null
          source_type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          annotation_id?: string | null
          content?: string
          content_hash?: string | null
          created_at?: string | null
          highlight_id?: string | null
          id?: string
          note_id?: string
          source_meta?: Json | null
          source_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_materials_annotation_id_fkey"
            columns: ["annotation_id"]
            isOneToOne: false
            referencedRelation: "annotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_materials_highlight_id_fkey"
            columns: ["highlight_id"]
            isOneToOne: false
            referencedRelation: "highlights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_materials_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_progress: {
        Row: {
          created_at: string | null
          id: string
          last_read_at: string | null
          note_id: string
          read_count: number | null
          scroll_percentage: number | null
          scroll_position: number | null
          total_read_time: number | null
          updated_at: string | null
          user_id: string
          video_position: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_read_at?: string | null
          note_id: string
          read_count?: number | null
          scroll_percentage?: number | null
          scroll_position?: number | null
          total_read_time?: number | null
          updated_at?: string | null
          user_id: string
          video_position?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_read_at?: string | null
          note_id?: string
          read_count?: number | null
          scroll_percentage?: number | null
          scroll_position?: number | null
          total_read_time?: number | null
          updated_at?: string | null
          user_id?: string
          video_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reading_progress_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_redemptions: {
        Row: {
          code: string
          days_granted: number
          id: string
          inviter_user_id: string
          redeemed_at: string
          redeemer_user_id: string
        }
        Insert: {
          code: string
          days_granted?: number
          id?: string
          inviter_user_id: string
          redeemed_at?: string
          redeemer_user_id: string
        }
        Update: {
          code?: string
          days_granted?: number
          id?: string
          inviter_user_id?: string
          redeemed_at?: string
          redeemer_user_id?: string
        }
        Relationships: []
      }
      subscription_orders: {
        Row: {
          amount: number
          created_at: string | null
          expires_at: string | null
          id: string
          out_trade_no: string
          paid_at: string | null
          pay_type: string | null
          plan_type: string
          status: string
          trade_no: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          expires_at?: string | null
          id?: string
          out_trade_no: string
          paid_at?: string | null
          pay_type?: string | null
          plan_type: string
          status?: string
          trade_no?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          expires_at?: string | null
          id?: string
          out_trade_no?: string
          paid_at?: string | null
          pay_type?: string | null
          plan_type?: string
          status?: string
          trade_no?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          last_accessed_at: string | null
          name: string
          parent_id: string | null
          position: number | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          last_accessed_at?: string | null
          name: string
          parent_id?: string | null
          position?: number | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          last_accessed_at?: string | null
          name?: string
          parent_id?: string | null
          position?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_markers: {
        Row: {
          id: string
          user_id: string
          note_id: string
          marker_kind: "important" | "question" | "todo"
          target_type: "transcript" | "qa" | "speaker"
          segment_idx: number | null
          speaker_id: string | null
          anchor_time: number | null
          selection_start: number | null
          selection_end: number | null
          selection_text: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          note_id: string
          marker_kind: "important" | "question" | "todo"
          target_type: "transcript" | "qa" | "speaker"
          segment_idx?: number | null
          speaker_id?: string | null
          anchor_time?: number | null
          selection_start?: number | null
          selection_end?: number | null
          selection_text?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          note_id?: string
          marker_kind?: "important" | "question" | "todo"
          target_type?: "transcript" | "qa" | "speaker"
          segment_idx?: number | null
          speaker_id?: string | null
          anchor_time?: number | null
          selection_start?: number | null
          selection_end?: number | null
          selection_text?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_markers_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      transcripts: {
        Row: {
          audio_duration: number | null
          created_at: string | null
          error_message: string | null
          full_text: string
          id: string
          language: string | null
          note_id: string
          provider: string | null
          segments: Json
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audio_duration?: number | null
          created_at?: string | null
          error_message?: string | null
          full_text: string
          id?: string
          language?: string | null
          note_id: string
          provider?: string | null
          segments: Json
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audio_duration?: number | null
          created_at?: string | null
          error_message?: string | null
          full_text?: string
          id?: string
          language?: string | null
          note_id?: string
          provider?: string | null
          segments?: Json
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: true
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memberships: {
        Row: {
          expires_at: string | null
          invite_rewarded_days: number
          last_payment_at: string | null
          plan_type: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          invite_rewarded_days?: number
          last_payment_at?: string | null
          plan_type?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          invite_rewarded_days?: number
          last_payment_at?: string | null
          plan_type?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          ai_preferences: Json | null
          created_at: string | null
          id: string
          reader_preferences: Json | null
          updated_at: string | null
          user_id: string
          video_preferences: Json | null
        }
        Insert: {
          ai_preferences?: Json | null
          created_at?: string | null
          id?: string
          reader_preferences?: Json | null
          updated_at?: string | null
          user_id: string
          video_preferences?: Json | null
        }
        Update: {
          ai_preferences?: Json | null
          created_at?: string | null
          id?: string
          reader_preferences?: Json | null
          updated_at?: string | null
          user_id?: string
          video_preferences?: Json | null
        }
        Relationships: []
      }
      video_chapters: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          end_time: number | null
          generated_by_ai: boolean | null
          id: string
          note_id: string
          position: number
          start_time: number
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          end_time?: number | null
          generated_by_ai?: boolean | null
          id?: string
          note_id: string
          position: number
          start_time: number
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          end_time?: number | null
          generated_by_ai?: boolean | null
          id?: string
          note_id?: string
          position?: number
          start_time?: number
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_chapters_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      video_jobs: {
        Row: {
          audio_error: string | null
          audio_result: Json | null
          audio_status: string
          audio_task_id: string | null
          cos_key: string | null
          cos_url: string | null
          cover_status: string
          cover_url: string | null
          created_at: string
          download_error: string | null
          download_status: string
          download_strategy: string
          frame_status: string
          frames: Json | null
          id: string
          next_retry_at: string | null
          note_id: string | null
          platform: string
          probe_data: Json | null
          probe_status: string
          request_headers: Json | null
          retry_count: number
          size_bytes: number | null
          source_url: string
          source_video_url: string
          transcode_job_id: string | null
          transcode_status: string
          transcoded_key: string | null
          transcoded_url: string | null
          updated_at: string
          user_id: string
          visual_error: string | null
          visual_result: Json | null
          visual_status: string
        }
        Insert: {
          audio_error?: string | null
          audio_result?: Json | null
          audio_status?: string
          audio_task_id?: string | null
          cos_key?: string | null
          cos_url?: string | null
          cover_status?: string
          cover_url?: string | null
          created_at?: string
          download_error?: string | null
          download_status?: string
          download_strategy: string
          frame_status?: string
          frames?: Json | null
          id?: string
          next_retry_at?: string | null
          note_id?: string | null
          platform: string
          probe_data?: Json | null
          probe_status?: string
          request_headers?: Json | null
          retry_count?: number
          size_bytes?: number | null
          source_url: string
          source_video_url: string
          transcode_job_id?: string | null
          transcode_status?: string
          transcoded_key?: string | null
          transcoded_url?: string | null
          updated_at?: string
          user_id: string
          visual_error?: string | null
          visual_result?: Json | null
          visual_status?: string
        }
        Update: {
          audio_error?: string | null
          audio_result?: Json | null
          audio_status?: string
          audio_task_id?: string | null
          cos_key?: string | null
          cos_url?: string | null
          cover_status?: string
          cover_url?: string | null
          created_at?: string
          download_error?: string | null
          download_status?: string
          download_strategy?: string
          frame_status?: string
          frames?: Json | null
          id?: string
          next_retry_at?: string | null
          note_id?: string | null
          platform?: string
          probe_data?: Json | null
          probe_status?: string
          request_headers?: Json | null
          retry_count?: number
          size_bytes?: number | null
          source_url?: string
          source_video_url?: string
          transcode_job_id?: string | null
          transcode_status?: string
          transcoded_key?: string | null
          transcoded_url?: string | null
          updated_at?: string
          user_id?: string
          visual_error?: string | null
          visual_result?: Json | null
          visual_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_jobs_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      web_archives: {
        Row: {
          archived_at: string
          created_at: string | null
          file_size_bytes: number | null
          id: string
          note_id: string
          original_url: string
          screenshot_url: string | null
          snapshot_url: string
          user_id: string
        }
        Insert: {
          archived_at?: string
          created_at?: string | null
          file_size_bytes?: number | null
          id?: string
          note_id: string
          original_url: string
          screenshot_url?: string | null
          snapshot_url: string
          user_id: string
        }
        Update: {
          archived_at?: string
          created_at?: string | null
          file_size_bytes?: number | null
          id?: string
          note_id?: string
          original_url?: string
          screenshot_url?: string | null
          snapshot_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_archives_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: true
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_untagged_notes: { Args: never; Returns: number }
      get_membership_status: {
        Args: { p_user_id: string }
        Returns: {
          can_access_ai: boolean
          can_access_pro: boolean
          days_remaining: number
          expires_at: string
          is_active: boolean
          is_trial: boolean
          is_trial_expired: boolean
          plan_type: string
        }[]
      }
      get_or_create_user_settings: {
        Args: { p_user_id: string }
        Returns: {
          ai_preferences: Json | null
          created_at: string | null
          id: string
          reader_preferences: Json | null
          updated_at: string | null
          user_id: string
          video_preferences: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "user_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      seed_sample_data: { Args: never; Returns: undefined }
      upsert_reading_progress: {
        Args: {
          p_note_id: string
          p_read_time?: number
          p_scroll_percentage?: number
          p_scroll_position?: number
          p_user_id: string
          p_video_position?: number
        }
        Returns: {
          created_at: string | null
          id: string
          last_read_at: string | null
          note_id: string
          read_count: number | null
          scroll_percentage: number | null
          scroll_position: number | null
          total_read_time: number | null
          updated_at: string | null
          user_id: string
          video_position: number | null
        }
        SetofOptions: {
          from: "*"
          to: "reading_progress"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      content_type: "article" | "video" | "audio"
      note_source_type: "url" | "manual" | "upload"
      note_status: "unread" | "reading" | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      content_type: ["article", "video", "audio"],
      note_source_type: ["url", "manual", "upload"],
      note_status: ["unread", "reading", "archived"],
    },
  },
} as const

