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
      api_rate_limits: {
        Row: {
          bucket_key: string
          hit_count: number
          window_start: string
        }
        Insert: {
          bucket_key: string
          hit_count?: number
          window_start?: string
        }
        Update: {
          bucket_key?: string
          hit_count?: number
          window_start?: string
        }
        Relationships: []
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
            foreignKeyName: "bookings_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["transaction_id"]
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
      fraud_events: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          risk_score: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fraud_events_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_events_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "packages_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["transaction_id"]
          },
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
      payment_events: {
        Row: {
          amount: number | null
          currency: string
          event_type: string
          id: string
          idempotency_key: string | null
          metadata: Json
          occurred_at: string
          payment_id: string
          provider: string | null
          provider_ref: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          currency?: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          occurred_at?: string
          payment_id: string
          provider?: string | null
          provider_ref?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          currency?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          occurred_at?: string
          payment_id?: string
          provider?: string | null
          provider_ref?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          operation: string
          response_body: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          key: string
          operation: string
          response_body?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          operation?: string
          response_body?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_idempotency_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_idempotency_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_users_public"
            referencedColumns: ["id"]
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
      cleanup_api_rate_limits: { Args: never; Returns: number }
      cleanup_expired_idempotency_keys: { Args: never; Returns: number }
      cleanup_old_profile_changes: { Args: never; Returns: undefined }
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
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
      reset_rate_limit: { Args: { p_key: string }; Returns: undefined }
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
} as const
