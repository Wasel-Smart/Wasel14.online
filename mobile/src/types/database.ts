export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  api: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      Wasel: "14141414"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  pgmq_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      pop: {
        Args: { queue_name: string }
        Returns: unknown[]
        SetofOptions: {
          from: "*"
          to: "message_record"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      read: {
        Args: { n: number; queue_name: string; sleep_seconds: number }
        Returns: unknown[]
        SetofOptions: {
          from: "*"
          to: "message_record"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      send: {
        Args: { message: Json; queue_name: string; sleep_seconds?: number }
        Returns: number[]
      }
      send_batch: {
        Args: { messages: Json[]; queue_name: string; sleep_seconds?: number }
        Returns: number[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          entity_id: string | null
          entity_type: string | null
          log_id: string
          metadata: Json
          timestamp: string
        }
        Insert: {
          action: string
          admin_id: string
          entity_id?: string | null
          entity_type?: string | null
          log_id?: string
          metadata?: Json
          timestamp?: string
        }
        Update: {
          action?: string
          admin_id?: string
          entity_id?: string | null
          entity_type?: string | null
          log_id?: string
          metadata?: Json
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_logs: {
        Row: {
          backup_type: string
          completed_at: string | null
          duration_seconds: number | null
          error_message: string | null
          id: string
          started_at: string | null
          status: string
          tables_backed_up: string[] | null
          total_rows: number | null
          total_size_mb: number | null
        }
        Insert: {
          backup_type: string
          completed_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          started_at?: string | null
          status: string
          tables_backed_up?: string[] | null
          total_rows?: number | null
          total_size_mb?: number | null
        }
        Update: {
          backup_type?: string
          completed_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string
          tables_backed_up?: string[] | null
          total_rows?: number | null
          total_size_mb?: number | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          amount: number
          booking_id: string
          booking_status: Database["public"]["Enums"]["booking_status_v2"]
          confirmed_by_driver: boolean
          created_at: string
          dropoff_location: string | null
          dropoff_name: string | null
          passenger_id: string
          payment_transaction_id: string | null
          pickup_location: string | null
          pickup_name: string | null
          price_per_seat: number | null
          seat_number: number
          seats_booked: number | null
          seats_requested: number | null
          status: string | null
          total_price: number | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id?: string
          booking_status?: Database["public"]["Enums"]["booking_status_v2"]
          confirmed_by_driver?: boolean
          created_at?: string
          dropoff_location?: string | null
          dropoff_name?: string | null
          passenger_id: string
          payment_transaction_id?: string | null
          pickup_location?: string | null
          pickup_name?: string | null
          price_per_seat?: number | null
          seat_number: number
          seats_booked?: number | null
          seats_requested?: number | null
          status?: string | null
          total_price?: number | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          booking_status?: Database["public"]["Enums"]["booking_status_v2"]
          confirmed_by_driver?: boolean
          created_at?: string
          dropoff_location?: string | null
          dropoff_name?: string | null
          passenger_id?: string
          payment_transaction_id?: string | null
          pickup_location?: string | null
          pickup_name?: string | null
          price_per_seat?: number | null
          seat_number?: number
          seats_booked?: number | null
          seats_requested?: number | null
          status?: string | null
          total_price?: number | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trips_public"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      campaigns: {
        Row: {
          action_url: string | null
          clicked_count: number | null
          created_at: string | null
          delivered_count: number | null
          id: string
          image_url: string | null
          message_ar: string
          message_en: string
          name: string
          opened_count: number | null
          recipient_count: number | null
          scheduled_for: string | null
          sent_at: string | null
          status: string | null
          target_audience: Json | null
          title_ar: string | null
          title_en: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          action_url?: string | null
          clicked_count?: number | null
          created_at?: string | null
          delivered_count?: number | null
          id?: string
          image_url?: string | null
          message_ar: string
          message_en: string
          name: string
          opened_count?: number | null
          recipient_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          target_audience?: Json | null
          title_ar?: string | null
          title_en?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          action_url?: string | null
          clicked_count?: number | null
          created_at?: string | null
          delivered_count?: number | null
          id?: string
          image_url?: string | null
          message_ar?: string
          message_en?: string
          name?: string
          opened_count?: number | null
          recipient_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          target_audience?: Json | null
          title_ar?: string | null
          title_en?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_media: {
        Row: {
          created_at: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          message_id: string
          mime_type: string | null
          thumbnail_url: string | null
        }
        Insert: {
          created_at?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          message_id: string
          mime_type?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          created_at?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          message_id?: string
          mime_type?: string | null
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_deliveries: {
        Row: {
          attempts_count: number
          channel: string
          created_at: string
          delivered_at: string | null
          delivery_id: string
          delivery_status: string
          destination: string | null
          error_message: string | null
          external_reference: string | null
          failed_at: string | null
          idempotency_key: string | null
          last_attempt_at: string | null
          locked_at: string | null
          next_attempt_at: string | null
          notification_id: string | null
          payload: Json | null
          processed_by: string | null
          provider_name: string | null
          provider_response: Json | null
          queued_at: string | null
          sent_at: string | null
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts_count?: number
          channel: string
          created_at?: string
          delivered_at?: string | null
          delivery_id?: string
          delivery_status?: string
          destination?: string | null
          error_message?: string | null
          external_reference?: string | null
          failed_at?: string | null
          idempotency_key?: string | null
          last_attempt_at?: string | null
          locked_at?: string | null
          next_attempt_at?: string | null
          notification_id?: string | null
          payload?: Json | null
          processed_by?: string | null
          provider_name?: string | null
          provider_response?: Json | null
          queued_at?: string | null
          sent_at?: string | null
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts_count?: number
          channel?: string
          created_at?: string
          delivered_at?: string | null
          delivery_id?: string
          delivery_status?: string
          destination?: string | null
          error_message?: string | null
          external_reference?: string | null
          failed_at?: string | null
          idempotency_key?: string | null
          last_attempt_at?: string | null
          locked_at?: string | null
          next_attempt_at?: string | null
          notification_id?: string | null
          payload?: Json | null
          processed_by?: string | null
          provider_name?: string | null
          provider_response?: Json | null
          queued_at?: string | null
          sent_at?: string | null
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_preferences: {
        Row: {
          booking_requests_enabled: boolean
          created_at: string
          critical_alerts_enabled: boolean
          email_enabled: boolean
          in_app_enabled: boolean
          messages_enabled: boolean
          prayer_reminders_enabled: boolean
          preferred_language: string
          promotions_enabled: boolean
          push_enabled: boolean
          sms_enabled: boolean
          trip_updates_enabled: boolean
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          booking_requests_enabled?: boolean
          created_at?: string
          critical_alerts_enabled?: boolean
          email_enabled?: boolean
          in_app_enabled?: boolean
          messages_enabled?: boolean
          prayer_reminders_enabled?: boolean
          preferred_language?: string
          promotions_enabled?: boolean
          push_enabled?: boolean
          sms_enabled?: boolean
          trip_updates_enabled?: boolean
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          booking_requests_enabled?: boolean
          created_at?: string
          critical_alerts_enabled?: boolean
          email_enabled?: boolean
          in_app_enabled?: boolean
          messages_enabled?: boolean
          prayer_reminders_enabled?: boolean
          preferred_language?: string
          promotions_enabled?: boolean
          push_enabled?: boolean
          sms_enabled?: boolean
          trip_updates_enabled?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "communication_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          conversation_id: string
          created_at: string
          created_by: string
          title: string
          updated_at: string
        }
        Insert: {
          conversation_id?: string
          created_at?: string
          created_by: string
          title?: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          created_by?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_alerts: {
        Row: {
          created_at: string
          destination_city: string
          id: string
          origin_city: string
          requested_date: string
          seats_or_slots: number
          service_type: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          destination_city: string
          id?: string
          origin_city: string
          requested_date: string
          seats_or_slots?: number
          service_type: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          destination_city?: string
          id?: string
          origin_city?: string
          requested_date?: string
          seats_or_slots?: number
          service_type?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          app_version: string | null
          created_at: string | null
          device_id: string
          device_name: string | null
          device_type: string | null
          id: string
          last_active: string | null
          os_version: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string | null
          device_id: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          last_active?: string | null
          os_version?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string | null
          device_id?: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          last_active?: string | null
          os_version?: string | null
          user_id?: string
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          driver_id: string
          heading: number | null
          id: string
          location: unknown
          speed: number | null
          trip_id: string | null
          updated_at: string | null
        }
        Insert: {
          accuracy?: number | null
          driver_id: string
          heading?: number | null
          id?: string
          location: unknown
          speed?: number | null
          trip_id?: string | null
          updated_at?: string | null
        }
        Update: {
          accuracy?: number | null
          driver_id?: string
          heading?: number | null
          id?: string
          location?: unknown
          speed?: number | null
          trip_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      driver_payouts: {
        Row: {
          bonuses: number | null
          commission: number | null
          created_at: string | null
          currency: string | null
          deductions: number | null
          driver_id: string
          gross_earnings: number | null
          id: string
          net_payout: number | null
          paid_at: string | null
          payout_method: string | null
          period_end: string
          period_start: string
          status: string | null
          total_trips: number | null
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          bonuses?: number | null
          commission?: number | null
          created_at?: string | null
          currency?: string | null
          deductions?: number | null
          driver_id: string
          gross_earnings?: number | null
          id?: string
          net_payout?: number | null
          paid_at?: string | null
          payout_method?: string | null
          period_end: string
          period_start: string
          status?: string | null
          total_trips?: number | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          bonuses?: number | null
          commission?: number | null
          created_at?: string | null
          currency?: string | null
          deductions?: number | null
          driver_id?: string
          gross_earnings?: number | null
          id?: string
          net_payout?: number | null
          paid_at?: string | null
          payout_method?: string | null
          period_end?: string
          period_start?: string
          status?: string | null
          total_trips?: number | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      driver_status_history: {
        Row: {
          created_at: string | null
          driver_id: string
          id: string
          is_available: boolean | null
          location: unknown
          status: string
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          id?: string
          is_available?: boolean | null
          location?: unknown
          status: string
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          id?: string
          is_available?: boolean | null
          location?: unknown
          status?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          background_check_status: Database["public"]["Enums"]["verification_status_v2"]
          created_at: string
          driver_id: string
          driver_status: Database["public"]["Enums"]["driver_status_v2"]
          license_number: string
          sanad_identity_linked: boolean
          updated_at: string
          user_id: string
          vehicle_id: string | null
          verification_level: Database["public"]["Enums"]["verification_level_v2"]
        }
        Insert: {
          background_check_status?: Database["public"]["Enums"]["verification_status_v2"]
          created_at?: string
          driver_id?: string
          driver_status?: Database["public"]["Enums"]["driver_status_v2"]
          license_number: string
          sanad_identity_linked?: boolean
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
          verification_level?: Database["public"]["Enums"]["verification_level_v2"]
        }
        Update: {
          background_check_status?: Database["public"]["Enums"]["verification_status_v2"]
          created_at?: string
          driver_id?: string
          driver_status?: Database["public"]["Enums"]["driver_status_v2"]
          license_number?: string
          sanad_identity_linked?: boolean
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
          verification_level?: Database["public"]["Enums"]["verification_level_v2"]
        }
        Relationships: [
          {
            foreignKeyName: "drivers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      event_outbox: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_attempt_at: string | null
          payload: Json
          processed_at: string | null
          producer: string
          status: string
          topic: string
          trace_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          payload?: Json
          processed_at?: string | null
          producer: string
          status?: string
          topic: string
          trace_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          payload?: Json
          processed_at?: string | null
          producer?: string
          status?: string
          topic?: string
          trace_id?: string | null
        }
        Relationships: []
      }
      growth_events: {
        Row: {
          created_at: string
          event_name: string
          funnel_stage: string
          id: string
          metadata: Json | null
          monetary_value_jod: number
          route_from: string | null
          route_to: string | null
          service_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          funnel_stage: string
          id?: string
          metadata?: Json | null
          monetary_value_jod?: number
          route_from?: string | null
          route_to?: string | null
          service_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          funnel_stage?: string
          id?: string
          metadata?: Json | null
          monetary_value_jod?: number
          route_from?: string | null
          route_to?: string | null
          service_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "growth_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      message_thread_summaries: {
        Row: {
          conversation_id: string
          created_at: string
          created_by: string
          model: string
          prompt_version: number
          summary_id: string
          summary_text: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          created_by: string
          model: string
          prompt_version?: number
          summary_id?: string
          summary_text: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          created_by?: string
          model?: string
          prompt_version?: number
          summary_id?: string
          summary_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_thread_summaries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "message_thread_summaries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_thread_summaries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          message_id?: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          created_at: string
          id: number
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          message_ar: string | null
          metadata: Json
          read: boolean
          read_at: string | null
          related_booking_id: string | null
          related_trip_id: string | null
          title: string
          title_ar: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          message_ar?: string | null
          metadata?: Json
          read?: boolean
          read_at?: string | null
          related_booking_id?: string | null
          related_trip_id?: string | null
          title: string
          title_ar?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          message_ar?: string | null
          metadata?: Json
          read?: boolean
          read_at?: string | null
          related_booking_id?: string | null
          related_trip_id?: string | null
          title?: string
          title_ar?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_booking_id_fkey"
            columns: ["related_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "notifications_related_trip_id_fkey"
            columns: ["related_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "notifications_related_trip_id_fkey"
            columns: ["related_trip_id"]
            isOneToOne: false
            referencedRelation: "v_trips_public"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_sessions: {
        Row: {
          attempts: number
          consumed_at: string | null
          created_at: string
          expires_at: string
          max_attempts: number
          otp_hash: string
          otp_session_id: string
          phone_number: string
          purpose: Database["public"]["Enums"]["otp_purpose_v2"]
          user_id: string | null
        }
        Insert: {
          attempts?: number
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          max_attempts?: number
          otp_hash: string
          otp_session_id?: string
          phone_number: string
          purpose: Database["public"]["Enums"]["otp_purpose_v2"]
          user_id?: string | null
        }
        Update: {
          attempts?: number
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          max_attempts?: number
          otp_hash?: string
          otp_session_id?: string
          phone_number?: string
          purpose?: Database["public"]["Enums"]["otp_purpose_v2"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "otp_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "otp_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      package_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_status: string
          event_type: string
          notes: string | null
          package_event_id: string
          package_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_status: string
          event_type: string
          notes?: string | null
          package_event_id?: string
          package_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_status?: string
          event_type?: string
          notes?: string | null
          package_event_id?: string
          package_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_events_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["package_id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_fee: number
          description: string | null
          destination_location: string | null
          destination_name: string | null
          fee_amount: number
          origin_location: string | null
          origin_name: string | null
          package_code: string
          package_id: string
          package_status: Database["public"]["Enums"]["package_status_v2"]
          payment_transaction_id: string | null
          qr_code: string | null
          receiver_id: string | null
          receiver_name: string | null
          receiver_phone: string | null
          sender_id: string
          status: string | null
          tracking_number: string | null
          trip_id: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_fee?: number
          description?: string | null
          destination_location?: string | null
          destination_name?: string | null
          fee_amount?: number
          origin_location?: string | null
          origin_name?: string | null
          package_code: string
          package_id?: string
          package_status?: Database["public"]["Enums"]["package_status_v2"]
          payment_transaction_id?: string | null
          qr_code?: string | null
          receiver_id?: string | null
          receiver_name?: string | null
          receiver_phone?: string | null
          sender_id: string
          status?: string | null
          tracking_number?: string | null
          trip_id?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_fee?: number
          description?: string | null
          destination_location?: string | null
          destination_name?: string | null
          fee_amount?: number
          origin_location?: string | null
          origin_name?: string | null
          package_code?: string
          package_id?: string
          package_status?: Database["public"]["Enums"]["package_status_v2"]
          payment_transaction_id?: string | null
          qr_code?: string | null
          receiver_id?: string | null
          receiver_name?: string | null
          receiver_phone?: string | null
          sender_id?: string
          status?: string | null
          tracking_number?: string | null
          trip_id?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "packages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "packages_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "v_trips_public"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          is_default: boolean
          method_type: Database["public"]["Enums"]["payment_method_v2"]
          payment_method_id: string
          provider: string
          status: string
          token_reference: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_default?: boolean
          method_type: Database["public"]["Enums"]["payment_method_v2"]
          payment_method_id?: string
          provider: string
          status?: string
          token_reference: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_default?: boolean
          method_type?: Database["public"]["Enums"]["payment_method_v2"]
          payment_method_id?: string
          provider?: string
          status?: string
          token_reference?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          body: string
          created_at: string
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_change_history: {
        Row: {
          changed_at: string
          changed_by: string
          created_at: string
          field_name: string
          id: string
          ip_address: string | null
          new_value: string | null
          old_value: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          created_at?: string
          field_name: string
          id?: string
          ip_address?: string | null
          new_value?: string | null
          old_value?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          created_at?: string
          field_name?: string
          id?: string
          ip_address?: string | null
          new_value?: string | null
          old_value?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_change_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_change_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_change_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_change_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_code_usage: {
        Row: {
          created_at: string | null
          discount_amount: number | null
          id: string
          promo_code_id: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          promo_code_id: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          promo_code_id?: string
          trip_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          booking_id: string
          created_at: string
          driver_id: string
          id: string
          rating: number
          review: string | null
          rider_id: string
          tags: string[]
          trip_id: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          driver_id: string
          id?: string
          rating: number
          review?: string | null
          rider_id: string
          tags?: string[]
          trip_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          driver_id?: string
          id?: string
          rating?: number
          review?: string | null
          rider_id?: string
          tags?: string[]
          trip_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          redeemed_at: string | null
          referee_completed_first_trip: boolean
          referee_id: string
          referee_reward_jod: number
          referral_code: string
          referrer_id: string
          referrer_reward_jod: number
          referrer_rewarded: boolean
          rewarded_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          redeemed_at?: string | null
          referee_completed_first_trip?: boolean
          referee_id: string
          referee_reward_jod?: number
          referral_code: string
          referrer_id: string
          referrer_reward_jod?: number
          referrer_rewarded?: boolean
          rewarded_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          redeemed_at?: string | null
          referee_completed_first_trip?: boolean
          referee_id?: string
          referee_reward_jod?: number
          referral_code?: string
          referrer_id?: string
          referrer_reward_jod?: number
          referrer_rewarded?: boolean
          rewarded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_incidents: {
        Row: {
          created_at: string | null
          description: string
          evidence: Json | null
          id: string
          incident_type: string
          location: unknown
          reporter_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          status: string | null
          trip_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          evidence?: Json | null
          id?: string
          incident_type: string
          location?: unknown
          reporter_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          status?: string | null
          trip_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          evidence?: Json | null
          id?: string
          incident_type?: string
          location?: unknown
          reporter_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          status?: string | null
          trip_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          ended_at: string | null
          id: string
          plan: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_product_id: string | null
          stripe_subscription_id: string
          trial_end: string | null
          trial_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_product_id?: string | null
          stripe_subscription_id: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string
          stripe_product_id?: string | null
          stripe_subscription_id?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_events: {
        Row: {
          created_at: string
          id: string
          note: string | null
          status: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id: string
          note?: string | null
          status: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          status?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          channel: string
          created_at: string
          detail: string
          id: string
          priority: string
          related_id: string | null
          resolution_summary: string | null
          route_label: string | null
          status: string
          subject: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          detail: string
          id: string
          priority?: string
          related_id?: string | null
          resolution_summary?: string | null
          route_label?: string | null
          status?: string
          subject: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          detail?: string
          id?: string
          priority?: string
          related_id?: string | null
          resolution_summary?: string | null
          route_label?: string | null
          status?: string
          subject?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          direction: string
          metadata: Json
          payment_method: Database["public"]["Enums"]["payment_method_v2"]
          reference_id: string | null
          reference_type: string | null
          transaction_id: string
          transaction_status: Database["public"]["Enums"]["transaction_status_v2"]
          transaction_type: Database["public"]["Enums"]["transaction_type_v2"]
          updated_at: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          direction: string
          metadata?: Json
          payment_method: Database["public"]["Enums"]["payment_method_v2"]
          reference_id?: string | null
          reference_type?: string | null
          transaction_id?: string
          transaction_status?: Database["public"]["Enums"]["transaction_status_v2"]
          transaction_type: Database["public"]["Enums"]["transaction_type_v2"]
          updated_at?: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          direction?: string
          metadata?: Json
          payment_method?: Database["public"]["Enums"]["payment_method_v2"]
          reference_id?: string | null
          reference_type?: string | null
          transaction_id?: string
          transaction_status?: Database["public"]["Enums"]["transaction_status_v2"]
          transaction_type?: Database["public"]["Enums"]["transaction_type_v2"]
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["wallet_id"]
          },
        ]
      }
      trip_analytics: {
        Row: {
          average_fare: number | null
          average_rating: number | null
          cancelled_trips: number | null
          completed_trips: number | null
          created_at: string | null
          date: string
          hour: number | null
          id: string
          location_zone: string | null
          surge_multiplier: number | null
          total_revenue: number | null
          total_trips: number | null
          updated_at: string | null
        }
        Insert: {
          average_fare?: number | null
          average_rating?: number | null
          cancelled_trips?: number | null
          completed_trips?: number | null
          created_at?: string | null
          date: string
          hour?: number | null
          id?: string
          location_zone?: string | null
          surge_multiplier?: number | null
          total_revenue?: number | null
          total_trips?: number | null
          updated_at?: string | null
        }
        Update: {
          average_fare?: number | null
          average_rating?: number | null
          cancelled_trips?: number | null
          completed_trips?: number | null
          created_at?: string | null
          date?: string
          hour?: number | null
          id?: string
          location_zone?: string | null
          surge_multiplier?: number | null
          total_revenue?: number | null
          total_trips?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      trip_presence: {
        Row: {
          active_packages: number
          active_passengers: number
          created_at: string
          driver_id: string
          last_heartbeat_at: string
          last_location: Json
          trip_id: string
          trip_presence_id: string
          updated_at: string
        }
        Insert: {
          active_packages?: number
          active_passengers?: number
          created_at?: string
          driver_id: string
          last_heartbeat_at?: string
          last_location?: Json
          trip_id: string
          trip_presence_id?: string
          updated_at?: string
        }
        Update: {
          active_packages?: number
          active_passengers?: number
          created_at?: string
          driver_id?: string
          last_heartbeat_at?: string
          last_location?: Json
          trip_id?: string
          trip_presence_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_presence_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "trip_presence_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "v_drivers_public"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "trip_presence_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_presence_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "v_trips_public"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      trips: {
        Row: {
          allow_packages: boolean
          available_seats: number
          created_at: string
          deleted_at: string | null
          departure_time: string
          destination_city: string
          driver_id: string
          notes: string | null
          origin_city: string
          package_capacity: number
          package_slots_remaining: number
          price_per_seat: number
          trip_id: string
          trip_status: Database["public"]["Enums"]["trip_status_v2"]
          updated_at: string
          vehicle_make: string | null
          vehicle_model: string | null
        }
        Insert: {
          allow_packages?: boolean
          available_seats: number
          created_at?: string
          deleted_at?: string | null
          departure_time: string
          destination_city: string
          driver_id: string
          notes?: string | null
          origin_city: string
          package_capacity?: number
          package_slots_remaining?: number
          price_per_seat: number
          trip_id?: string
          trip_status?: Database["public"]["Enums"]["trip_status_v2"]
          updated_at?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
        }
        Update: {
          allow_packages?: boolean
          available_seats?: number
          created_at?: string
          deleted_at?: string | null
          departure_time?: string
          destination_city?: string
          driver_id?: string
          notes?: string | null
          origin_city?: string
          package_capacity?: number
          package_slots_remaining?: number
          price_per_seat?: number
          trip_id?: string
          trip_status?: Database["public"]["Enums"]["trip_status_v2"]
          updated_at?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "v_drivers_public"
            referencedColumns: ["driver_id"]
          },
        ]
      }
      universities: {
        Row: {
          city: string
          created_at: string | null
          discount_percentage: number | null
          email_domains: string[]
          id: string
          is_active: boolean | null
          name: string
          name_ar: string
          updated_at: string | null
        }
        Insert: {
          city: string
          created_at?: string | null
          discount_percentage?: number | null
          email_domains: string[]
          id?: string
          is_active?: boolean | null
          name: string
          name_ar: string
          updated_at?: string | null
        }
        Update: {
          city?: string
          created_at?: string | null
          discount_percentage?: number | null
          email_domains?: string[]
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          analytics_enabled: boolean | null
          created_at: string
          currency: string | null
          locale: string | null
          location_sharing_enabled: boolean | null
          photo_hidden: boolean | null
          profile_visible: boolean | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analytics_enabled?: boolean | null
          created_at?: string
          currency?: string | null
          locale?: string | null
          location_sharing_enabled?: boolean | null
          photo_hidden?: boolean | null
          profile_visible?: boolean | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analytics_enabled?: boolean | null
          created_at?: string
          currency?: string | null
          locale?: string | null
          location_sharing_enabled?: boolean | null
          photo_hidden?: boolean | null
          profile_visible?: boolean | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          national_id: string | null
          national_id_hash: string | null
          national_id_last4: string | null
          phone_number: string
          phone_verified_at: string | null
          profile_status: Database["public"]["Enums"]["profile_status_v2"]
          referral_code: string | null
          role: Database["public"]["Enums"]["user_role_v2"]
          sanad_verified_status: Database["public"]["Enums"]["verification_status_v2"]
          two_factor_backup_codes: string[] | null
          two_factor_enabled: boolean
          two_factor_secret: string | null
          updated_at: string
          verification_level: Database["public"]["Enums"]["verification_level_v2"]
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          national_id?: string | null
          national_id_hash?: string | null
          national_id_last4?: string | null
          phone_number: string
          phone_verified_at?: string | null
          profile_status?: Database["public"]["Enums"]["profile_status_v2"]
          referral_code?: string | null
          role?: Database["public"]["Enums"]["user_role_v2"]
          sanad_verified_status?: Database["public"]["Enums"]["verification_status_v2"]
          two_factor_backup_codes?: string[] | null
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          updated_at?: string
          verification_level?: Database["public"]["Enums"]["verification_level_v2"]
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          national_id?: string | null
          national_id_hash?: string | null
          national_id_last4?: string | null
          phone_number?: string
          phone_verified_at?: string | null
          profile_status?: Database["public"]["Enums"]["profile_status_v2"]
          referral_code?: string | null
          role?: Database["public"]["Enums"]["user_role_v2"]
          sanad_verified_status?: Database["public"]["Enums"]["verification_status_v2"]
          two_factor_backup_codes?: string[] | null
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          updated_at?: string
          verification_level?: Database["public"]["Enums"]["verification_level_v2"]
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          capacity: number
          created_at: string
          driver_id: string
          plate_number: string
          registration_status: Database["public"]["Enums"]["vehicle_registration_status_v2"]
          updated_at: string
          vehicle_id: string
          vehicle_type: string
        }
        Insert: {
          capacity: number
          created_at?: string
          driver_id: string
          plate_number: string
          registration_status?: Database["public"]["Enums"]["vehicle_registration_status_v2"]
          updated_at?: string
          vehicle_id?: string
          vehicle_type: string
        }
        Update: {
          capacity?: number
          created_at?: string
          driver_id?: string
          plate_number?: string
          registration_status?: Database["public"]["Enums"]["vehicle_registration_status_v2"]
          updated_at?: string
          vehicle_id?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "v_drivers_public"
            referencedColumns: ["driver_id"]
          },
        ]
      }
      verification_records: {
        Row: {
          created_at: string
          document_reference: string | null
          document_status: Database["public"]["Enums"]["verification_status_v2"]
          failure_reason: string | null
          provider_reference: string | null
          reviewer_admin_id: string | null
          sanad_status: Database["public"]["Enums"]["verification_status_v2"]
          updated_at: string
          user_id: string
          verification_id: string
          verification_level: Database["public"]["Enums"]["verification_level_v2"]
          verification_timestamp: string
        }
        Insert: {
          created_at?: string
          document_reference?: string | null
          document_status?: Database["public"]["Enums"]["verification_status_v2"]
          failure_reason?: string | null
          provider_reference?: string | null
          reviewer_admin_id?: string | null
          sanad_status?: Database["public"]["Enums"]["verification_status_v2"]
          updated_at?: string
          user_id: string
          verification_id?: string
          verification_level?: Database["public"]["Enums"]["verification_level_v2"]
          verification_timestamp?: string
        }
        Update: {
          created_at?: string
          document_reference?: string | null
          document_status?: Database["public"]["Enums"]["verification_status_v2"]
          failure_reason?: string | null
          provider_reference?: string | null
          reviewer_admin_id?: string | null
          sanad_status?: Database["public"]["Enums"]["verification_status_v2"]
          updated_at?: string
          user_id?: string
          verification_id?: string
          verification_level?: Database["public"]["Enums"]["verification_level_v2"]
          verification_timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          auto_top_up_amount: number
          auto_top_up_enabled: boolean
          auto_top_up_threshold: number
          balance: number
          created_at: string
          currency_code: string
          pending_balance: number
          pin_hash: string | null
          updated_at: string
          user_id: string
          wallet_id: string
          wallet_status: Database["public"]["Enums"]["wallet_status_v2"]
        }
        Insert: {
          auto_top_up_amount?: number
          auto_top_up_enabled?: boolean
          auto_top_up_threshold?: number
          balance?: number
          created_at?: string
          currency_code?: string
          pending_balance?: number
          pin_hash?: string | null
          updated_at?: string
          user_id: string
          wallet_id?: string
          wallet_status?: Database["public"]["Enums"]["wallet_status_v2"]
        }
        Update: {
          auto_top_up_amount?: number
          auto_top_up_enabled?: boolean
          auto_top_up_threshold?: number
          balance?: number
          created_at?: string
          currency_code?: string
          pending_balance?: number
          pin_hash?: string | null
          updated_at?: string
          user_id?: string
          wallet_id?: string
          wallet_status?: Database["public"]["Enums"]["wallet_status_v2"]
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      wasel_foreign_key: {
        Row: {
          amount: number | null
          attrs: Json | null
          balance_type: string | null
          currency: string | null
        }
        Insert: {
          amount?: number | null
          attrs?: Json | null
          balance_type?: string | null
          currency?: string | null
        }
        Update: {
          amount?: number | null
          attrs?: Json | null
          balance_type?: string | null
          currency?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      backup_status: {
        Row: {
          avg_duration_seconds: number | null
          backup_type: string | null
          count: number | null
          last_backup: string | null
          status: string | null
          total_size_mb: number | null
        }
        Relationships: []
      }
      v_drivers_public: {
        Row: {
          background_check_status:
            | Database["public"]["Enums"]["verification_status_v2"]
            | null
          created_at: string | null
          driver_id: string | null
          driver_status: Database["public"]["Enums"]["driver_status_v2"] | null
          sanad_identity_linked: boolean | null
          user_id: string | null
          verification_level:
            | Database["public"]["Enums"]["verification_level_v2"]
            | null
        }
        Insert: {
          background_check_status?:
            | Database["public"]["Enums"]["verification_status_v2"]
            | null
          created_at?: string | null
          driver_id?: string | null
          driver_status?: Database["public"]["Enums"]["driver_status_v2"] | null
          sanad_identity_linked?: boolean | null
          user_id?: string | null
          verification_level?:
            | Database["public"]["Enums"]["verification_level_v2"]
            | null
        }
        Update: {
          background_check_status?:
            | Database["public"]["Enums"]["verification_status_v2"]
            | null
          created_at?: string | null
          driver_id?: string | null
          driver_status?: Database["public"]["Enums"]["driver_status_v2"] | null
          sanad_identity_linked?: boolean | null
          user_id?: string | null
          verification_level?:
            | Database["public"]["Enums"]["verification_level_v2"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      v_trips_public: {
        Row: {
          allow_packages: boolean | null
          available_seats: number | null
          created_at: string | null
          departure_time: string | null
          destination_city: string | null
          driver_id: string | null
          origin_city: string | null
          package_capacity: number | null
          package_slots_remaining: number | null
          price_per_seat: number | null
          trip_id: string | null
          trip_status: Database["public"]["Enums"]["trip_status_v2"] | null
        }
        Insert: {
          allow_packages?: boolean | null
          available_seats?: number | null
          created_at?: string | null
          departure_time?: string | null
          destination_city?: string | null
          driver_id?: string | null
          origin_city?: string | null
          package_capacity?: number | null
          package_slots_remaining?: number | null
          price_per_seat?: number | null
          trip_id?: string | null
          trip_status?: Database["public"]["Enums"]["trip_status_v2"] | null
        }
        Update: {
          allow_packages?: boolean | null
          available_seats?: number | null
          created_at?: string | null
          departure_time?: string | null
          destination_city?: string | null
          driver_id?: string | null
          origin_city?: string | null
          package_capacity?: number | null
          package_slots_remaining?: number | null
          price_per_seat?: number | null
          trip_id?: string | null
          trip_status?: Database["public"]["Enums"]["trip_status_v2"] | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "v_drivers_public"
            referencedColumns: ["driver_id"]
          },
        ]
      }
      v_users_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          profile_status:
            | Database["public"]["Enums"]["profile_status_v2"]
            | null
          role: Database["public"]["Enums"]["user_role_v2"] | null
          verification_level:
            | Database["public"]["Enums"]["verification_level_v2"]
            | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          profile_status?:
            | Database["public"]["Enums"]["profile_status_v2"]
            | null
          role?: Database["public"]["Enums"]["user_role_v2"] | null
          verification_level?:
            | Database["public"]["Enums"]["verification_level_v2"]
            | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          profile_status?:
            | Database["public"]["Enums"]["profile_status_v2"]
            | null
          role?: Database["public"]["Enums"]["user_role_v2"] | null
          verification_level?:
            | Database["public"]["Enums"]["verification_level_v2"]
            | null
        }
        Relationships: []
      }
    }
    Functions: {
      app_add_wallet_funds: {
        Args: {
          p_amount: number
          p_external_reference?: string
          p_payment_method: Database["public"]["Enums"]["payment_method_v2"]
          p_user_id: string
        }
        Returns: string
      }
      app_approve_driver: {
        Args: { p_admin_id: string; p_driver_id: string }
        Returns: string
      }
      app_assign_package_to_trip: {
        Args: { p_package_id: string; p_trip_id: string }
        Returns: string
      }
      app_book_trip: {
        Args: {
          p_passenger_id: string
          p_payment_method?: Database["public"]["Enums"]["payment_method_v2"]
          p_seat_number: number
          p_trip_id: string
        }
        Returns: string
      }
      app_complete_sanad_verification: {
        Args: {
          p_admin_id?: string
          p_failure_reason?: string
          p_user_id: string
          p_verified: boolean
        }
        Returns: string
      }
      app_confirm_package_delivery: {
        Args: { p_driver_id: string; p_package_id: string }
        Returns: string
      }
      app_create_trip: {
        Args: {
          p_allow_packages?: boolean
          p_available_seats: number
          p_departure_time: string
          p_destination_city: string
          p_driver_id: string
          p_origin_city: string
          p_package_capacity?: number
          p_price_per_seat: number
        }
        Returns: string
      }
      app_credit_driver_earnings: {
        Args: { p_booking_id: string }
        Returns: string
      }
      app_submit_sanad_verification: {
        Args: {
          p_document_reference?: string
          p_provider_reference?: string
          p_user_id: string
        }
        Returns: string
      }
      app_transfer_wallet_funds: {
        Args: {
          p_amount: number
          p_from_user_id: string
          p_payment_method?: Database["public"]["Enums"]["payment_method_v2"]
          p_to_user_id: string
        }
        Returns: {
          credit_transaction_id: string
          debit_transaction_id: string
        }[]
      }
      calc_loyalty_tier: { Args: { lifetime_points: number }; Returns: string }
      calc_surge_multiplier: {
        Args: { available_drivers: number; pending_trips: number }
        Returns: number
      }
      cleanup_old_profile_changes: { Args: never; Returns: undefined }
      create_critical_data_snapshot: { Args: never; Returns: Json }
      current_user_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      function_name: { Args: never; Returns: undefined }
      geo_distance_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      log_backup: {
        Args: {
          p_backup_type: string
          p_error?: string
          p_status: string
          p_tables?: string[]
        }
        Returns: string
      }
      verify_backup_integrity: {
        Args: never
        Returns: {
          last_updated: string
          row_count: number
          size_mb: number
          table_name: string
        }[]
      }
      version: { Args: never; Returns: Json }
      wallet_post_transaction: {
        Args: {
          p_amount: number
          p_direction: string
          p_metadata?: Json
          p_payment_method: Database["public"]["Enums"]["payment_method_v2"]
          p_reference_id?: string
          p_reference_type?: string
          p_transaction_type: Database["public"]["Enums"]["transaction_type_v2"]
          p_wallet_id: string
        }
        Returns: string
      }
    }
    Enums: {
      booking_status_v2:
        | "pending_payment"
        | "confirmed"
        | "checked_in"
        | "completed"
        | "cancelled"
        | "refunded"
      driver_status_v2:
        | "draft"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "suspended"
        | "offline"
        | "online"
        | "busy"
      otp_purpose_v2:
        | "login"
        | "wallet_transfer"
        | "wallet_withdrawal"
        | "driver_action"
        | "admin_action"
      package_status_v2:
        | "created"
        | "assigned"
        | "in_transit"
        | "delivered"
        | "cancelled"
        | "disputed"
      payment_method_v2:
        | "wallet_balance"
        | "card_payment"
        | "local_gateway"
        | "government_api"
      profile_status_v2: "pending" | "active" | "suspended" | "blocked"
      transaction_status_v2:
        | "pending"
        | "authorized"
        | "posted"
        | "failed"
        | "reversed"
        | "refunded"
      transaction_type_v2:
        | "add_funds"
        | "withdraw_funds"
        | "transfer_funds"
        | "ride_payment"
        | "package_payment"
        | "driver_earning"
        | "refund"
        | "adjustment"
        | "hold"
        | "release"
      trip_status_v2:
        | "draft"
        | "open"
        | "booked"
        | "in_progress"
        | "completed"
        | "cancelled"
      user_role_v2: "passenger" | "driver" | "admin"
      vehicle_registration_status_v2:
        | "pending"
        | "active"
        | "expired"
        | "rejected"
        | "suspended"
      verification_level_v2: "level_0" | "level_1" | "level_2" | "level_3"
      verification_status_v2:
        | "unverified"
        | "pending"
        | "verified"
        | "rejected"
        | "expired"
      wallet_status_v2: "active" | "limited" | "frozen" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  stripe: {
    Tables: {
      _managed_webhooks: {
        Row: {
          account_id: string
          api_version: string | null
          created: number | null
          description: string | null
          enabled: boolean | null
          enabled_events: Json
          id: string
          last_synced_at: string | null
          livemode: boolean | null
          metadata: Json | null
          object: string | null
          secret: string
          status: string | null
          updated_at: string
          url: string
        }
        Insert: {
          account_id: string
          api_version?: string | null
          created?: number | null
          description?: string | null
          enabled?: boolean | null
          enabled_events: Json
          id: string
          last_synced_at?: string | null
          livemode?: boolean | null
          metadata?: Json | null
          object?: string | null
          secret: string
          status?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          account_id?: string
          api_version?: string | null
          created?: number | null
          description?: string | null
          enabled?: boolean | null
          enabled_events?: Json
          id?: string
          last_synced_at?: string | null
          livemode?: boolean | null
          metadata?: Json | null
          object?: string | null
          secret?: string
          status?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_managed_webhooks_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      _migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      _rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      _sync_obj_runs: {
        Row: {
          _account_id: string
          completed_at: string | null
          created_gte: number
          created_lte: number
          cursor: string | null
          error_message: string | null
          object: string
          page_cursor: string | null
          priority: number
          processed_count: number
          run_started_at: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          _account_id: string
          completed_at?: string | null
          created_gte?: number
          created_lte?: number
          cursor?: string | null
          error_message?: string | null
          object: string
          page_cursor?: string | null
          priority?: number
          processed_count?: number
          run_started_at: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          _account_id?: string
          completed_at?: string | null
          created_gte?: number
          created_lte?: number
          cursor?: string | null
          error_message?: string | null
          object?: string
          page_cursor?: string | null
          priority?: number
          processed_count?: number
          run_started_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sync_obj_runs_parent"
            columns: ["_account_id", "run_started_at"]
            isOneToOne: false
            referencedRelation: "_sync_runs"
            referencedColumns: ["_account_id", "started_at"]
          },
          {
            foreignKeyName: "fk_sync_obj_runs_parent"
            columns: ["_account_id", "run_started_at"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["account_id", "started_at"]
          },
        ]
      }
      _sync_runs: {
        Row: {
          _account_id: string
          closed_at: string | null
          error_message: string | null
          max_concurrent: number
          started_at: string
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          _account_id: string
          closed_at?: string | null
          error_message?: string | null
          max_concurrent?: number
          started_at?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          _account_id?: string
          closed_at?: string | null
          error_message?: string | null
          max_concurrent?: number
          started_at?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sync_runs_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          _last_synced_at: string
          _raw_data: Json
          _updated_at: string
          api_key_hashes: string[]
          first_synced_at: string
          id: string
        }
        Insert: {
          _last_synced_at?: string
          _raw_data: Json
          _updated_at?: string
          api_key_hashes?: string[]
          first_synced_at?: string
          id?: string
        }
        Update: {
          _last_synced_at?: string
          _raw_data?: Json
          _updated_at?: string
          api_key_hashes?: string[]
          first_synced_at?: string
          id?: string
        }
        Relationships: []
      }
      active_entitlements: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          customer: string | null
          feature: string | null
          id: string
          livemode: boolean | null
          lookup_key: string | null
          object: string | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          customer?: string | null
          feature?: string | null
          id?: string
          livemode?: boolean | null
          lookup_key?: string | null
          object?: string | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          customer?: string | null
          feature?: string | null
          id?: string
          livemode?: boolean | null
          lookup_key?: string | null
          object?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_active_entitlements_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      charges: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          amount: number | null
          amount_refunded: number | null
          application: string | null
          application_fee: string | null
          application_fee_amount: number | null
          balance_transaction: string | null
          billing_details: Json | null
          calculated_statement_descriptor: string | null
          captured: boolean | null
          created: number | null
          currency: string | null
          customer: string | null
          description: string | null
          disputed: boolean | null
          failure_code: string | null
          failure_message: string | null
          fraud_details: Json | null
          id: string
          invoice: string | null
          livemode: boolean | null
          metadata: Json | null
          object: string | null
          on_behalf_of: string | null
          order: string | null
          outcome: Json | null
          paid: boolean | null
          payment_intent: string | null
          payment_method: string | null
          payment_method_details: Json | null
          receipt_email: string | null
          receipt_number: string | null
          receipt_url: string | null
          refunded: boolean | null
          refunds: Json | null
          review: string | null
          shipping: Json | null
          source_transfer: string | null
          statement_descriptor: string | null
          statement_descriptor_suffix: string | null
          status: string | null
          transfer: string | null
          transfer_data: Json | null
          transfer_group: string | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          amount?: number | null
          amount_refunded?: number | null
          application?: string | null
          application_fee?: string | null
          application_fee_amount?: number | null
          balance_transaction?: string | null
          billing_details?: Json | null
          calculated_statement_descriptor?: string | null
          captured?: boolean | null
          created?: number | null
          currency?: string | null
          customer?: string | null
          description?: string | null
          disputed?: boolean | null
          failure_code?: string | null
          failure_message?: string | null
          fraud_details?: Json | null
          id?: string
          invoice?: string | null
          livemode?: boolean | null
          metadata?: Json | null
          object?: string | null
          on_behalf_of?: string | null
          order?: string | null
          outcome?: Json | null
          paid?: boolean | null
          payment_intent?: string | null
          payment_method?: string | null
          payment_method_details?: Json | null
          receipt_email?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          refunded?: boolean | null
          refunds?: Json | null
          review?: string | null
          shipping?: Json | null
          source_transfer?: string | null
          statement_descriptor?: string | null
          statement_descriptor_suffix?: string | null
          status?: string | null
          transfer?: string | null
          transfer_data?: Json | null
          transfer_group?: string | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          amount?: number | null
          amount_refunded?: number | null
          application?: string | null
          application_fee?: string | null
          application_fee_amount?: number | null
          balance_transaction?: string | null
          billing_details?: Json | null
          calculated_statement_descriptor?: string | null
          captured?: boolean | null
          created?: number | null
          currency?: string | null
          customer?: string | null
          description?: string | null
          disputed?: boolean | null
          failure_code?: string | null
          failure_message?: string | null
          fraud_details?: Json | null
          id?: string
          invoice?: string | null
          livemode?: boolean | null
          metadata?: Json | null
          object?: string | null
          on_behalf_of?: string | null
          order?: string | null
          outcome?: Json | null
          paid?: boolean | null
          payment_intent?: string | null
          payment_method?: string | null
          payment_method_details?: Json | null
          receipt_email?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          refunded?: boolean | null
          refunds?: Json | null
          review?: string | null
          shipping?: Json | null
          source_transfer?: string | null
          statement_descriptor?: string | null
          statement_descriptor_suffix?: string | null
          status?: string | null
          transfer?: string | null
          transfer_data?: Json | null
          transfer_group?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_charges_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_session_line_items: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          amount_discount: number | null
          amount_subtotal: number | null
          amount_tax: number | null
          amount_total: number | null
          checkout_session: string | null
          currency: string | null
          description: string | null
          discounts: Json | null
          id: string
          object: string | null
          price: Json | null
          quantity: number | null
          taxes: Json | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          amount_discount?: number | null
          amount_subtotal?: number | null
          amount_tax?: number | null
          amount_total?: number | null
          checkout_session?: string | null
          currency?: string | null
          description?: string | null
          discounts?: Json | null
          id?: string
          object?: string | null
          price?: Json | null
          quantity?: number | null
          taxes?: Json | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          amount_discount?: number | null
          amount_subtotal?: number | null
          amount_tax?: number | null
          amount_total?: number | null
          checkout_session?: string | null
          currency?: string | null
          description?: string | null
          discounts?: Json | null
          id?: string
          object?: string | null
          price?: Json | null
          quantity?: number | null
          taxes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_checkout_session_line_items_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_sessions: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          allow_promotion_codes: boolean | null
          amount_subtotal: number | null
          amount_total: number | null
          billing_address_collection: string | null
          cancel_url: string | null
          client_reference_id: string | null
          currency: string | null
          customer: string | null
          customer_email: string | null
          id: string
          line_items: Json | null
          livemode: boolean | null
          locale: string | null
          metadata: Json | null
          mode: string | null
          object: string | null
          payment_intent: string | null
          payment_method_types: Json | null
          setup_intent: string | null
          shipping: Json | null
          shipping_address_collection: Json | null
          submit_type: string | null
          subscription: string | null
          success_url: string | null
          total_details: Json | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          allow_promotion_codes?: boolean | null
          amount_subtotal?: number | null
          amount_total?: number | null
          billing_address_collection?: string | null
          cancel_url?: string | null
          client_reference_id?: string | null
          currency?: string | null
          customer?: string | null
          customer_email?: string | null
          id?: string
          line_items?: Json | null
          livemode?: boolean | null
          locale?: string | null
          metadata?: Json | null
          mode?: string | null
          object?: string | null
          payment_intent?: string | null
          payment_method_types?: Json | null
          setup_intent?: string | null
          shipping?: Json | null
          shipping_address_collection?: Json | null
          submit_type?: string | null
          subscription?: string | null
          success_url?: string | null
          total_details?: Json | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          allow_promotion_codes?: boolean | null
          amount_subtotal?: number | null
          amount_total?: number | null
          billing_address_collection?: string | null
          cancel_url?: string | null
          client_reference_id?: string | null
          currency?: string | null
          customer?: string | null
          customer_email?: string | null
          id?: string
          line_items?: Json | null
          livemode?: boolean | null
          locale?: string | null
          metadata?: Json | null
          mode?: string | null
          object?: string | null
          payment_intent?: string | null
          payment_method_types?: Json | null
          setup_intent?: string | null
          shipping?: Json | null
          shipping_address_collection?: Json | null
          submit_type?: string | null
          subscription?: string | null
          success_url?: string | null
          total_details?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_checkout_sessions_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          amount_off: number | null
          applies_to: Json | null
          created: number | null
          currency: string | null
          duration: string | null
          duration_in_months: number | null
          id: string
          livemode: boolean | null
          max_redemptions: number | null
          metadata: Json | null
          name: string | null
          object: string | null
          percent_off: number | null
          redeem_by: number | null
          times_redeemed: number | null
          valid: boolean | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          amount_off?: number | null
          applies_to?: Json | null
          created?: number | null
          currency?: string | null
          duration?: string | null
          duration_in_months?: number | null
          id?: string
          livemode?: boolean | null
          max_redemptions?: number | null
          metadata?: Json | null
          name?: string | null
          object?: string | null
          percent_off?: number | null
          redeem_by?: number | null
          times_redeemed?: number | null
          valid?: boolean | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          amount_off?: number | null
          applies_to?: Json | null
          created?: number | null
          currency?: string | null
          duration?: string | null
          duration_in_months?: number | null
          id?: string
          livemode?: boolean | null
          max_redemptions?: number | null
          metadata?: Json | null
          name?: string | null
          object?: string | null
          percent_off?: number | null
          redeem_by?: number | null
          times_redeemed?: number | null
          valid?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_coupons_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          amount: number | null
          created: number | null
          currency: string | null
          customer: string | null
          customer_balance_transaction: string | null
          discount_amount: number | null
          discount_amounts: Json | null
          id: string
          invoice: string | null
          lines: Json | null
          livemode: boolean | null
          memo: string | null
          metadata: Json | null
          number: string | null
          object: string | null
          out_of_band_amount: number | null
          pdf: string | null
          reason: string | null
          refund: string | null
          status: string | null
          subtotal: number | null
          tax_amounts: Json | null
          total: number | null
          type: string | null
          voided_at: number | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          amount?: number | null
          created?: number | null
          currency?: string | null
          customer?: string | null
          customer_balance_transaction?: string | null
          discount_amount?: number | null
          discount_amounts?: Json | null
          id?: string
          invoice?: string | null
          lines?: Json | null
          livemode?: boolean | null
          memo?: string | null
          metadata?: Json | null
          number?: string | null
          object?: string | null
          out_of_band_amount?: number | null
          pdf?: string | null
          reason?: string | null
          refund?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amounts?: Json | null
          total?: number | null
          type?: string | null
          voided_at?: number | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          amount?: number | null
          created?: number | null
          currency?: string | null
          customer?: string | null
          customer_balance_transaction?: string | null
          discount_amount?: number | null
          discount_amounts?: Json | null
          id?: string
          invoice?: string | null
          lines?: Json | null
          livemode?: boolean | null
          memo?: string | null
          metadata?: Json | null
          number?: string | null
          object?: string | null
          out_of_band_amount?: number | null
          pdf?: string | null
          reason?: string | null
          refund?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amounts?: Json | null
          total?: number | null
          type?: string | null
          voided_at?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_credit_notes_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          address: Json | null
          balance: number | null
          created: number | null
          currency: string | null
          default_source: string | null
          deleted: boolean | null
          delinquent: boolean | null
          description: string | null
          discount: Json | null
          email: string | null
          id: string
          invoice_prefix: string | null
          invoice_settings: Json | null
          livemode: boolean | null
          metadata: Json | null
          name: string | null
          next_invoice_sequence: number | null
          object: string | null
          phone: string | null
          preferred_locales: Json | null
          shipping: Json | null
          sources: Json | null
          subscriptions: Json | null
          tax_exempt: string | null
          tax_ids: Json | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          address?: Json | null
          balance?: number | null
          created?: number | null
          currency?: string | null
          default_source?: string | null
          deleted?: boolean | null
          delinquent?: boolean | null
          description?: string | null
          discount?: Json | null
          email?: string | null
          id?: string
          invoice_prefix?: string | null
          invoice_settings?: Json | null
          livemode?: boolean | null
          metadata?: Json | null
          name?: string | null
          next_invoice_sequence?: number | null
          object?: string | null
          phone?: string | null
          preferred_locales?: Json | null
          shipping?: Json | null
          sources?: Json | null
          subscriptions?: Json | null
          tax_exempt?: string | null
          tax_ids?: Json | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          address?: Json | null
          balance?: number | null
          created?: number | null
          currency?: string | null
          default_source?: string | null
          deleted?: boolean | null
          delinquent?: boolean | null
          description?: string | null
          discount?: Json | null
          email?: string | null
          id?: string
          invoice_prefix?: string | null
          invoice_settings?: Json | null
          livemode?: boolean | null
          metadata?: Json | null
          name?: string | null
          next_invoice_sequence?: number | null
          object?: string | null
          phone?: string | null
          preferred_locales?: Json | null
          shipping?: Json | null
          sources?: Json | null
          subscriptions?: Json | null
          tax_exempt?: string | null
          tax_ids?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_customers_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          amount: number | null
          balance_transactions: Json | null
          charge: string | null
          created: number | null
          currency: string | null
          evidence: Json | null
          evidence_details: Json | null
          id: string
          is_charge_refundable: boolean | null
          livemode: boolean | null
          metadata: Json | null
          object: string | null
          payment_intent: string | null
          reason: string | null
          status: string | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          amount?: number | null
          balance_transactions?: Json | null
          charge?: string | null
          created?: number | null
          currency?: string | null
          evidence?: Json | null
          evidence_details?: Json | null
          id?: string
          is_charge_refundable?: boolean | null
          livemode?: boolean | null
          metadata?: Json | null
          object?: string | null
          payment_intent?: string | null
          reason?: string | null
          status?: string | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          amount?: number | null
          balance_transactions?: Json | null
          charge?: string | null
          created?: number | null
          currency?: string | null
          evidence?: Json | null
          evidence_details?: Json | null
          id?: string
          is_charge_refundable?: boolean | null
          livemode?: boolean | null
          metadata?: Json | null
          object?: string | null
          payment_intent?: string | null
          reason?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_disputes_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      early_fraud_warnings: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          actionable: boolean | null
          charge: string | null
          created: number | null
          fraud_type: string | null
          id: string
          livemode: boolean | null
          object: string | null
          payment_intent: string | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          actionable?: boolean | null
          charge?: string | null
          created?: number | null
          fraud_type?: string | null
          id?: string
          livemode?: boolean | null
          object?: string | null
          payment_intent?: string | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          actionable?: boolean | null
          charge?: string | null
          created?: number | null
          fraud_type?: string | null
          id?: string
          livemode?: boolean | null
          object?: string | null
          payment_intent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_early_fraud_warnings_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      features: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          active: boolean | null
          id: string
          livemode: boolean | null
          lookup_key: string | null
          metadata: Json | null
          name: string | null
          object: string | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          active?: boolean | null
          id?: string
          livemode?: boolean | null
          lookup_key?: string | null
          metadata?: Json | null
          name?: string | null
          object?: string | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          active?: boolean | null
          id?: string
          livemode?: boolean | null
          lookup_key?: string | null
          metadata?: Json | null
          name?: string | null
          object?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_features_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          account_country: string | null
          account_name: string | null
          amount_due: number | null
          amount_paid: number | null
          amount_remaining: number | null
          application_fee_amount: number | null
          attempt_count: number | null
          attempted: boolean | null
          auto_advance: boolean | null
          billing_reason: string | null
          charge: string | null
          collection_method: string | null
          created: number | null
          currency: string | null
          custom_fields: Json | null
          customer: string | null
          customer_address: Json | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_shipping: Json | null
          customer_tax_exempt: string | null
          customer_tax_ids: Json | null
          default_payment_method: string | null
          default_source: string | null
          default_tax_rates: Json | null
          description: string | null
          discount: Json | null
          discounts: Json | null
          due_date: number | null
          ending_balance: number | null
          footer: string | null
          hosted_invoice_url: string | null
          id: string
          invoice_pdf: string | null
          lines: Json | null
          livemode: boolean | null
          metadata: Json | null
          next_payment_attempt: number | null
          number: string | null
          object: string | null
          paid: boolean | null
          payment_intent: string | null
          period_end: number | null
          period_start: number | null
          post_payment_credit_notes_amount: number | null
          pre_payment_credit_notes_amount: number | null
          receipt_number: string | null
          starting_balance: number | null
          statement_descriptor: string | null
          status: string | null
          status_transitions: Json | null
          subscription: string | null
          subscription_proration_date: number | null
          subtotal: number | null
          tax: number | null
          threshold_reason: Json | null
          total: number | null
          total_discount_amounts: Json | null
          total_tax_amounts: Json | null
          transfer_data: Json | null
          webhooks_delivered_at: number | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          account_country?: string | null
          account_name?: string | null
          amount_due?: number | null
          amount_paid?: number | null
          amount_remaining?: number | null
          application_fee_amount?: number | null
          attempt_count?: number | null
          attempted?: boolean | null
          auto_advance?: boolean | null
          billing_reason?: string | null
          charge?: string | null
          collection_method?: string | null
          created?: number | null
          currency?: string | null
          custom_fields?: Json | null
          customer?: string | null
          customer_address?: Json | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_shipping?: Json | null
          customer_tax_exempt?: string | null
          customer_tax_ids?: Json | null
          default_payment_method?: string | null
          default_source?: string | null
          default_tax_rates?: Json | null
          description?: string | null
          discount?: Json | null
          discounts?: Json | null
          due_date?: number | null
          ending_balance?: number | null
          footer?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf?: string | null
          lines?: Json | null
          livemode?: boolean | null
          metadata?: Json | null
          next_payment_attempt?: number | null
          number?: string | null
          object?: string | null
          paid?: boolean | null
          payment_intent?: string | null
          period_end?: number | null
          period_start?: number | null
          post_payment_credit_notes_amount?: number | null
          pre_payment_credit_notes_amount?: number | null
          receipt_number?: string | null
          starting_balance?: number | null
          statement_descriptor?: string | null
          status?: string | null
          status_transitions?: Json | null
          subscription?: string | null
          subscription_proration_date?: number | null
          subtotal?: number | null
          tax?: number | null
          threshold_reason?: Json | null
          total?: number | null
          total_discount_amounts?: Json | null
          total_tax_amounts?: Json | null
          transfer_data?: Json | null
          webhooks_delivered_at?: number | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          account_country?: string | null
          account_name?: string | null
          amount_due?: number | null
          amount_paid?: number | null
          amount_remaining?: number | null
          application_fee_amount?: number | null
          attempt_count?: number | null
          attempted?: boolean | null
          auto_advance?: boolean | null
          billing_reason?: string | null
          charge?: string | null
          collection_method?: string | null
          created?: number | null
          currency?: string | null
          custom_fields?: Json | null
          customer?: string | null
          customer_address?: Json | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_shipping?: Json | null
          customer_tax_exempt?: string | null
          customer_tax_ids?: Json | null
          default_payment_method?: string | null
          default_source?: string | null
          default_tax_rates?: Json | null
          description?: string | null
          discount?: Json | null
          discounts?: Json | null
          due_date?: number | null
          ending_balance?: number | null
          footer?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf?: string | null
          lines?: Json | null
          livemode?: boolean | null
          metadata?: Json | null
          next_payment_attempt?: number | null
          number?: string | null
          object?: string | null
          paid?: boolean | null
          payment_intent?: string | null
          period_end?: number | null
          period_start?: number | null
          post_payment_credit_notes_amount?: number | null
          pre_payment_credit_notes_amount?: number | null
          receipt_number?: string | null
          starting_balance?: number | null
          statement_descriptor?: string | null
          status?: string | null
          status_transitions?: Json | null
          subscription?: string | null
          subscription_proration_date?: number | null
          subtotal?: number | null
          tax?: number | null
          threshold_reason?: Json | null
          total?: number | null
          total_discount_amounts?: Json | null
          total_tax_amounts?: Json | null
          transfer_data?: Json | null
          webhooks_delivered_at?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoices_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          amount: number | null
          amount_capturable: number | null
          amount_received: number | null
          application: string | null
          application_fee_amount: number | null
          canceled_at: number | null
          cancellation_reason: string | null
          capture_method: string | null
          charges: Json | null
          client_secret: string | null
          confirmation_method: string | null
          created: number | null
          currency: string | null
          customer: string | null
          description: string | null
          id: string
          invoice: string | null
          last_payment_error: Json | null
          livemode: boolean | null
          metadata: Json | null
          next_action: Json | null
          object: string | null
          on_behalf_of: string | null
          payment_method: string | null
          payment_method_options: Json | null
          payment_method_types: Json | null
          receipt_email: string | null
          review: string | null
          setup_future_usage: string | null
          shipping: Json | null
          statement_descriptor: string | null
          statement_descriptor_suffix: string | null
          status: string | null
          transfer_data: Json | null
          transfer_group: string | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          amount?: number | null
          amount_capturable?: number | null
          amount_received?: number | null
          application?: string | null
          application_fee_amount?: number | null
          canceled_at?: number | null
          cancellation_reason?: string | null
          capture_method?: string | null
          charges?: Json | null
          client_secret?: string | null
          confirmation_method?: string | null
          created?: number | null
          currency?: string | null
          customer?: string | null
          description?: string | null
          id?: string
          invoice?: string | null
          last_payment_error?: Json | null
          livemode?: boolean | null
          metadata?: Json | null
          next_action?: Json | null
          object?: string | null
          on_behalf_of?: string | null
          payment_method?: string | null
          payment_method_options?: Json | null
          payment_method_types?: Json | null
          receipt_email?: string | null
          review?: string | null
          setup_future_usage?: string | null
          shipping?: Json | null
          statement_descriptor?: string | null
          statement_descriptor_suffix?: string | null
          status?: string | null
          transfer_data?: Json | null
          transfer_group?: string | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          amount?: number | null
          amount_capturable?: number | null
          amount_received?: number | null
          application?: string | null
          application_fee_amount?: number | null
          canceled_at?: number | null
          cancellation_reason?: string | null
          capture_method?: string | null
          charges?: Json | null
          client_secret?: string | null
          confirmation_method?: string | null
          created?: number | null
          currency?: string | null
          customer?: string | null
          description?: string | null
          id?: string
          invoice?: string | null
          last_payment_error?: Json | null
          livemode?: boolean | null
          metadata?: Json | null
          next_action?: Json | null
          object?: string | null
          on_behalf_of?: string | null
          payment_method?: string | null
          payment_method_options?: Json | null
          payment_method_types?: Json | null
          receipt_email?: string | null
          review?: string | null
          setup_future_usage?: string | null
          shipping?: Json | null
          statement_descriptor?: string | null
          statement_descriptor_suffix?: string | null
          status?: string | null
          transfer_data?: Json | null
          transfer_group?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_payment_intents_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          alipay: Json | null
          au_becs_debit: Json | null
          bacs_debit: Json | null
          bancontact: Json | null
          billing_details: Json | null
          card: Json | null
          card_present: Json | null
          created: number | null
          customer: string | null
          eps: Json | null
          fpx: Json | null
          giropay: Json | null
          id: string
          ideal: Json | null
          interac_present: Json | null
          livemode: boolean | null
          metadata: Json | null
          object: string | null
          p24: Json | null
          sepa_debit: Json | null
          type: string | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          alipay?: Json | null
          au_becs_debit?: Json | null
          bacs_debit?: Json | null
          bancontact?: Json | null
          billing_details?: Json | null
          card?: Json | null
          card_present?: Json | null
          created?: number | null
          customer?: string | null
          eps?: Json | null
          fpx?: Json | null
          giropay?: Json | null
          id?: string
          ideal?: Json | null
          interac_present?: Json | null
          livemode?: boolean | null
          metadata?: Json | null
          object?: string | null
          p24?: Json | null
          sepa_debit?: Json | null
          type?: string | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          alipay?: Json | null
          au_becs_debit?: Json | null
          bacs_debit?: Json | null
          bancontact?: Json | null
          billing_details?: Json | null
          card?: Json | null
          card_present?: Json | null
          created?: number | null
          customer?: string | null
          eps?: Json | null
          fpx?: Json | null
          giropay?: Json | null
          id?: string
          ideal?: Json | null
          interac_present?: Json | null
          livemode?: boolean | null
          metadata?: Json | null
          object?: string | null
          p24?: Json | null
          sepa_debit?: Json | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_payment_methods_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          active: boolean | null
          aggregate_usage: string | null
          amount: number | null
          amount_decimal: string | null
          billing_scheme: string | null
          created: number | null
          currency: string | null
          id: string
          interval: string | null
          interval_count: number | null
          livemode: boolean | null
          metadata: Json | null
          nickname: string | null
          object: string | null
          product: string | null
          tiers: Json | null
          tiers_mode: string | null
          transform_usage: Json | null
          trial_period_days: number | null
          usage_type: string | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          active?: boolean | null
          aggregate_usage?: string | null
          amount?: number | null
          amount_decimal?: string | null
          billing_scheme?: string | null
          created?: number | null
          currency?: string | null
          id?: string
          interval?: string | null
          interval_count?: number | null
          livemode?: boolean | null
          metadata?: Json | null
          nickname?: string | null
          object?: string | null
          product?: string | null
          tiers?: Json | null
          tiers_mode?: string | null
          transform_usage?: Json | null
          trial_period_days?: number | null
          usage_type?: string | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          active?: boolean | null
          aggregate_usage?: string | null
          amount?: number | null
          amount_decimal?: string | null
          billing_scheme?: string | null
          created?: number | null
          currency?: string | null
          id?: string
          interval?: string | null
          interval_count?: number | null
          livemode?: boolean | null
          metadata?: Json | null
          nickname?: string | null
          object?: string | null
          product?: string | null
          tiers?: Json | null
          tiers_mode?: string | null
          transform_usage?: Json | null
          trial_period_days?: number | null
          usage_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_plans_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      prices: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          active: boolean | null
          billing_scheme: string | null
          created: number | null
          currency: string | null
          id: string
          livemode: boolean | null
          lookup_key: string | null
          metadata: Json | null
          nickname: string | null
          object: string | null
          product: string | null
          recurring: Json | null
          tiers: Json | null
          tiers_mode: string | null
          transform_quantity: Json | null
          type: string | null
          unit_amount: number | null
          unit_amount_decimal: string | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          active?: boolean | null
          billing_scheme?: string | null
          created?: number | null
          currency?: string | null
          id?: string
          livemode?: boolean | null
          lookup_key?: string | null
          metadata?: Json | null
          nickname?: string | null
          object?: string | null
          product?: string | null
          recurring?: Json | null
          tiers?: Json | null
          tiers_mode?: string | null
          transform_quantity?: Json | null
          type?: string | null
          unit_amount?: number | null
          unit_amount_decimal?: string | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          active?: boolean | null
          billing_scheme?: string | null
          created?: number | null
          currency?: string | null
          id?: string
          livemode?: boolean | null
          lookup_key?: string | null
          metadata?: Json | null
          nickname?: string | null
          object?: string | null
          product?: string | null
          recurring?: Json | null
          tiers?: Json | null
          tiers_mode?: string | null
          transform_quantity?: Json | null
          type?: string | null
          unit_amount?: number | null
          unit_amount_decimal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_prices_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          active: boolean | null
          attributes: Json | null
          caption: string | null
          created: number | null
          deactivate_on: Json | null
          description: string | null
          id: string
          images: Json | null
          livemode: boolean | null
          metadata: Json | null
          name: string | null
          object: string | null
          package_dimensions: Json | null
          shippable: boolean | null
          statement_descriptor: string | null
          type: string | null
          unit_label: string | null
          updated: number | null
          url: string | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          active?: boolean | null
          attributes?: Json | null
          caption?: string | null
          created?: number | null
          deactivate_on?: Json | null
          description?: string | null
          id?: string
          images?: Json | null
          livemode?: boolean | null
          metadata?: Json | null
          name?: string | null
          object?: string | null
          package_dimensions?: Json | null
          shippable?: boolean | null
          statement_descriptor?: string | null
          type?: string | null
          unit_label?: string | null
          updated?: number | null
          url?: string | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          active?: boolean | null
          attributes?: Json | null
          caption?: string | null
          created?: number | null
          deactivate_on?: Json | null
          description?: string | null
          id?: string
          images?: Json | null
          livemode?: boolean | null
          metadata?: Json | null
          name?: string | null
          object?: string | null
          package_dimensions?: Json | null
          shippable?: boolean | null
          statement_descriptor?: string | null
          type?: string | null
          unit_label?: string | null
          updated?: number | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_products_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          amount: number | null
          balance_transaction: string | null
          charge: string | null
          created: number | null
          currency: string | null
          description: string | null
          failure_balance_transaction: string | null
          failure_reason: string | null
          id: string
          metadata: Json | null
          object: string | null
          payment_intent: string | null
          reason: string | null
          receipt_number: string | null
          source_transfer_reversal: string | null
          status: string | null
          transfer_reversal: string | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          amount?: number | null
          balance_transaction?: string | null
          charge?: string | null
          created?: number | null
          currency?: string | null
          description?: string | null
          failure_balance_transaction?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          object?: string | null
          payment_intent?: string | null
          reason?: string | null
          receipt_number?: string | null
          source_transfer_reversal?: string | null
          status?: string | null
          transfer_reversal?: string | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          amount?: number | null
          balance_transaction?: string | null
          charge?: string | null
          created?: number | null
          currency?: string | null
          description?: string | null
          failure_balance_transaction?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          object?: string | null
          payment_intent?: string | null
          reason?: string | null
          receipt_number?: string | null
          source_transfer_reversal?: string | null
          status?: string | null
          transfer_reversal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_refunds_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          billing_zip: string | null
          charge: string | null
          closed_reason: string | null
          created: number | null
          id: string
          ip_address: string | null
          ip_address_location: Json | null
          livemode: boolean | null
          object: string | null
          open: boolean | null
          opened_reason: string | null
          payment_intent: string | null
          reason: string | null
          session: Json | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          billing_zip?: string | null
          charge?: string | null
          closed_reason?: string | null
          created?: number | null
          id?: string
          ip_address?: string | null
          ip_address_location?: Json | null
          livemode?: boolean | null
          object?: string | null
          open?: boolean | null
          opened_reason?: string | null
          payment_intent?: string | null
          reason?: string | null
          session?: Json | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          billing_zip?: string | null
          charge?: string | null
          closed_reason?: string | null
          created?: number | null
          id?: string
          ip_address?: string | null
          ip_address_location?: Json | null
          livemode?: boolean | null
          object?: string | null
          open?: boolean | null
          opened_reason?: string | null
          payment_intent?: string | null
          reason?: string | null
          session?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_reviews_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_intents: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          application: string | null
          cancellation_reason: string | null
          client_secret: string | null
          created: number | null
          customer: string | null
          description: string | null
          id: string
          last_setup_error: Json | null
          livemode: boolean | null
          mandate: string | null
          metadata: Json | null
          next_action: Json | null
          object: string | null
          on_behalf_of: string | null
          payment_method: string | null
          payment_method_options: Json | null
          payment_method_types: Json | null
          single_use_mandate: string | null
          status: string | null
          usage: string | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          application?: string | null
          cancellation_reason?: string | null
          client_secret?: string | null
          created?: number | null
          customer?: string | null
          description?: string | null
          id?: string
          last_setup_error?: Json | null
          livemode?: boolean | null
          mandate?: string | null
          metadata?: Json | null
          next_action?: Json | null
          object?: string | null
          on_behalf_of?: string | null
          payment_method?: string | null
          payment_method_options?: Json | null
          payment_method_types?: Json | null
          single_use_mandate?: string | null
          status?: string | null
          usage?: string | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          application?: string | null
          cancellation_reason?: string | null
          client_secret?: string | null
          created?: number | null
          customer?: string | null
          description?: string | null
          id?: string
          last_setup_error?: Json | null
          livemode?: boolean | null
          mandate?: string | null
          metadata?: Json | null
          next_action?: Json | null
          object?: string | null
          on_behalf_of?: string | null
          payment_method?: string | null
          payment_method_options?: Json | null
          payment_method_types?: Json | null
          single_use_mandate?: string | null
          status?: string | null
          usage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_setup_intents_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_items: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          billing_thresholds: Json | null
          created: number | null
          deleted: boolean | null
          id: string
          metadata: Json | null
          object: string | null
          price: Json | null
          quantity: number | null
          subscription: string | null
          tax_rates: Json | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          billing_thresholds?: Json | null
          created?: number | null
          deleted?: boolean | null
          id?: string
          metadata?: Json | null
          object?: string | null
          price?: Json | null
          quantity?: number | null
          subscription?: string | null
          tax_rates?: Json | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          billing_thresholds?: Json | null
          created?: number | null
          deleted?: boolean | null
          id?: string
          metadata?: Json | null
          object?: string | null
          price?: Json | null
          quantity?: number | null
          subscription?: string | null
          tax_rates?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_subscription_items_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_schedules: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          canceled_at: number | null
          completed_at: number | null
          created: number | null
          current_phase: Json | null
          customer: string | null
          default_settings: Json | null
          end_behavior: string | null
          id: string
          livemode: boolean | null
          metadata: Json | null
          object: string | null
          phases: Json | null
          released_at: number | null
          released_subscription: string | null
          status: string | null
          subscription: string | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          canceled_at?: number | null
          completed_at?: number | null
          created?: number | null
          current_phase?: Json | null
          customer?: string | null
          default_settings?: Json | null
          end_behavior?: string | null
          id?: string
          livemode?: boolean | null
          metadata?: Json | null
          object?: string | null
          phases?: Json | null
          released_at?: number | null
          released_subscription?: string | null
          status?: string | null
          subscription?: string | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          canceled_at?: number | null
          completed_at?: number | null
          created?: number | null
          current_phase?: Json | null
          customer?: string | null
          default_settings?: Json | null
          end_behavior?: string | null
          id?: string
          livemode?: boolean | null
          metadata?: Json | null
          object?: string | null
          phases?: Json | null
          released_at?: number | null
          released_subscription?: string | null
          status?: string | null
          subscription?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_subscription_schedules_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          application_fee_percent: number | null
          billing_cycle_anchor: number | null
          billing_thresholds: Json | null
          cancel_at: number | null
          cancel_at_period_end: boolean | null
          canceled_at: number | null
          collection_method: string | null
          created: number | null
          current_period_end: number | null
          current_period_start: number | null
          customer: string | null
          days_until_due: number | null
          default_payment_method: string | null
          default_source: string | null
          default_tax_rates: Json | null
          discount: Json | null
          ended_at: number | null
          id: string
          items: Json | null
          latest_invoice: string | null
          livemode: boolean | null
          metadata: Json | null
          next_pending_invoice_item_invoice: number | null
          object: string | null
          pause_collection: Json | null
          pending_invoice_item_interval: Json | null
          pending_setup_intent: string | null
          pending_update: Json | null
          quantity: number | null
          schedule: string | null
          start_date: number | null
          status: string | null
          transfer_data: Json | null
          trial_end: number | null
          trial_start: number | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          application_fee_percent?: number | null
          billing_cycle_anchor?: number | null
          billing_thresholds?: Json | null
          cancel_at?: number | null
          cancel_at_period_end?: boolean | null
          canceled_at?: number | null
          collection_method?: string | null
          created?: number | null
          current_period_end?: number | null
          current_period_start?: number | null
          customer?: string | null
          days_until_due?: number | null
          default_payment_method?: string | null
          default_source?: string | null
          default_tax_rates?: Json | null
          discount?: Json | null
          ended_at?: number | null
          id?: string
          items?: Json | null
          latest_invoice?: string | null
          livemode?: boolean | null
          metadata?: Json | null
          next_pending_invoice_item_invoice?: number | null
          object?: string | null
          pause_collection?: Json | null
          pending_invoice_item_interval?: Json | null
          pending_setup_intent?: string | null
          pending_update?: Json | null
          quantity?: number | null
          schedule?: string | null
          start_date?: number | null
          status?: string | null
          transfer_data?: Json | null
          trial_end?: number | null
          trial_start?: number | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          application_fee_percent?: number | null
          billing_cycle_anchor?: number | null
          billing_thresholds?: Json | null
          cancel_at?: number | null
          cancel_at_period_end?: boolean | null
          canceled_at?: number | null
          collection_method?: string | null
          created?: number | null
          current_period_end?: number | null
          current_period_start?: number | null
          customer?: string | null
          days_until_due?: number | null
          default_payment_method?: string | null
          default_source?: string | null
          default_tax_rates?: Json | null
          discount?: Json | null
          ended_at?: number | null
          id?: string
          items?: Json | null
          latest_invoice?: string | null
          livemode?: boolean | null
          metadata?: Json | null
          next_pending_invoice_item_invoice?: number | null
          object?: string | null
          pause_collection?: Json | null
          pending_invoice_item_interval?: Json | null
          pending_setup_intent?: string | null
          pending_update?: Json | null
          quantity?: number | null
          schedule?: string | null
          start_date?: number | null
          status?: string | null
          transfer_data?: Json | null
          trial_end?: number | null
          trial_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_subscriptions_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_ids: {
        Row: {
          _account_id: string
          _last_synced_at: string | null
          _raw_data: Json
          _updated_at: string
          country: string | null
          created: number | null
          customer: string | null
          id: string
          livemode: boolean | null
          object: string | null
          type: string | null
          value: string | null
          verification: Json | null
        }
        Insert: {
          _account_id: string
          _last_synced_at?: string | null
          _raw_data: Json
          _updated_at?: string
          country?: string | null
          created?: number | null
          customer?: string | null
          id?: string
          livemode?: boolean | null
          object?: string | null
          type?: string | null
          value?: string | null
          verification?: Json | null
        }
        Update: {
          _account_id?: string
          _last_synced_at?: string | null
          _raw_data?: Json
          _updated_at?: string
          country?: string | null
          created?: number | null
          customer?: string | null
          id?: string
          livemode?: boolean | null
          object?: string | null
          type?: string | null
          value?: string | null
          verification?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tax_ids_account"
            columns: ["_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      sync_obj_progress: {
        Row: {
          account_id: string | null
          object: string | null
          pct_complete: number | null
          processed: number | null
          run_started_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sync_obj_runs_parent"
            columns: ["account_id", "run_started_at"]
            isOneToOne: false
            referencedRelation: "_sync_runs"
            referencedColumns: ["_account_id", "started_at"]
          },
          {
            foreignKeyName: "fk_sync_obj_runs_parent"
            columns: ["account_id", "run_started_at"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["account_id", "started_at"]
          },
        ]
      }
      sync_runs: {
        Row: {
          account_id: string | null
          closed_at: string | null
          complete_count: number | null
          error_count: number | null
          error_message: string | null
          max_concurrent: number | null
          pending_count: number | null
          running_count: number | null
          started_at: string | null
          status: string | null
          total_objects: number | null
          total_processed: number | null
          triggered_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sync_runs_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_rate_limit: {
        Args: { max_requests: number; rate_key: string; window_seconds: number }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  api: {
    Enums: {
      Wasel: ["14141414"],
    },
  },
  graphql_public: {
    Enums: {},
  },
  pgmq_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_status_v2: [
        "pending_payment",
        "confirmed",
        "checked_in",
        "completed",
        "cancelled",
        "refunded",
      ],
      driver_status_v2: [
        "draft",
        "pending_approval",
        "approved",
        "rejected",
        "suspended",
        "offline",
        "online",
        "busy",
      ],
      otp_purpose_v2: [
        "login",
        "wallet_transfer",
        "wallet_withdrawal",
        "driver_action",
        "admin_action",
      ],
      package_status_v2: [
        "created",
        "assigned",
        "in_transit",
        "delivered",
        "cancelled",
        "disputed",
      ],
      payment_method_v2: [
        "wallet_balance",
        "card_payment",
        "local_gateway",
        "government_api",
      ],
      profile_status_v2: ["pending", "active", "suspended", "blocked"],
      transaction_status_v2: [
        "pending",
        "authorized",
        "posted",
        "failed",
        "reversed",
        "refunded",
      ],
      transaction_type_v2: [
        "add_funds",
        "withdraw_funds",
        "transfer_funds",
        "ride_payment",
        "package_payment",
        "driver_earning",
        "refund",
        "adjustment",
        "hold",
        "release",
      ],
      trip_status_v2: [
        "draft",
        "open",
        "booked",
        "in_progress",
        "completed",
        "cancelled",
      ],
      user_role_v2: ["passenger", "driver", "admin"],
      vehicle_registration_status_v2: [
        "pending",
        "active",
        "expired",
        "rejected",
        "suspended",
      ],
      verification_level_v2: ["level_0", "level_1", "level_2", "level_3"],
      verification_status_v2: [
        "unverified",
        "pending",
        "verified",
        "rejected",
        "expired",
      ],
      wallet_status_v2: ["active", "limited", "frozen", "closed"],
    },
  },
  stripe: {
    Enums: {},
  },
} as const
