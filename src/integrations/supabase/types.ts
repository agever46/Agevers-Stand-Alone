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
      abandoned_carts: {
        Row: {
          cart_items: Json
          created_at: string
          email_sent: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cart_items?: Json
          created_at?: string
          email_sent?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cart_items?: Json
          created_at?: string
          email_sent?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      account_appeals: {
        Row: {
          admin_comment: string | null
          blocked_reason: string | null
          buyer_message: string
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          admin_comment?: string | null
          blocked_reason?: string | null
          buyer_message: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          admin_comment?: string | null
          blocked_reason?: string | null
          buyer_message?: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      achievements: {
        Row: {
          created_at: string
          criteria_type: string
          criteria_value: number
          description: string
          display_order: number
          icon: string
          id: string
          is_active: boolean
          reward_type: string
          reward_value: number
          title: string
        }
        Insert: {
          created_at?: string
          criteria_type: string
          criteria_value: number
          description: string
          display_order?: number
          icon: string
          id: string
          is_active?: boolean
          reward_type: string
          reward_value: number
          title: string
        }
        Update: {
          created_at?: string
          criteria_type?: string
          criteria_value?: number
          description?: string
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          reward_type?: string
          reward_value?: number
          title?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action_type: string
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_title: string | null
          entity_type: string
          id: string
          ip_address: string | null
          performed_by: string
          performer_email: string | null
        }
        Insert: {
          action_type: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_title?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          performed_by: string
          performer_email?: string | null
        }
        Update: {
          action_type?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_title?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          performed_by?: string
          performer_email?: string | null
        }
        Relationships: []
      }
      affiliate_applications: {
        Row: {
          created_at: string
          email: string
          follower_count: string
          full_name: string
          id: string
          instagram_handle: string | null
          primary_niche: string
          promotion_plan: string
          status: string
          tiktok_handle: string | null
          updated_at: string
          youtube_handle: string | null
        }
        Insert: {
          created_at?: string
          email: string
          follower_count: string
          full_name: string
          id?: string
          instagram_handle?: string | null
          primary_niche: string
          promotion_plan: string
          status?: string
          tiktok_handle?: string | null
          updated_at?: string
          youtube_handle?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          follower_count?: string
          full_name?: string
          id?: string
          instagram_handle?: string | null
          primary_niche?: string
          promotion_plan?: string
          status?: string
          tiktok_handle?: string | null
          updated_at?: string
          youtube_handle?: string | null
        }
        Relationships: []
      }
      aliexpress_config: {
        Row: {
          access_token: string | null
          id: number
          refresh_expires_at: string | null
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          id?: number
          refresh_expires_at?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          id?: number
          refresh_expires_at?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      allowed_products: {
        Row: {
          aliexpress_product_id: string | null
          badges: string[] | null
          created_at: string
          description: string | null
          description_paraphrased: boolean
          developers: string[] | null
          expiration_date: string | null
          id: string
          image_url: string | null
          languages: string[] | null
          metadata_sync_status: string | null
          nav_menu_excludes: string[]
          nav_menu_includes: string[]
          original_title: string | null
          paraphrase_locked_at: string | null
          paraphrase_status: string
          platform: string
          platform_details: string | null
          product_type: string | null
          publishers: string[] | null
          region: string
          regional_limitations: string | null
          release_date: string | null
          screenshots: string[] | null
          slug: string
          sold_count: number
          steam_app_id: string | null
          store: string
          system_requirements: Json | null
          tab_category: string | null
          title: string
          video_url: string | null
          wishlist_count: number
        }
        Insert: {
          aliexpress_product_id?: string | null
          badges?: string[] | null
          created_at?: string
          description?: string | null
          description_paraphrased?: boolean
          developers?: string[] | null
          expiration_date?: string | null
          id?: string
          image_url?: string | null
          languages?: string[] | null
          metadata_sync_status?: string | null
          nav_menu_excludes?: string[]
          nav_menu_includes?: string[]
          original_title?: string | null
          paraphrase_locked_at?: string | null
          paraphrase_status?: string
          platform?: string
          platform_details?: string | null
          product_type?: string | null
          publishers?: string[] | null
          region?: string
          regional_limitations?: string | null
          release_date?: string | null
          screenshots?: string[] | null
          slug: string
          sold_count?: number
          steam_app_id?: string | null
          store?: string
          system_requirements?: Json | null
          tab_category?: string | null
          title: string
          video_url?: string | null
          wishlist_count?: number
        }
        Update: {
          aliexpress_product_id?: string | null
          badges?: string[] | null
          created_at?: string
          description?: string | null
          description_paraphrased?: boolean
          developers?: string[] | null
          expiration_date?: string | null
          id?: string
          image_url?: string | null
          languages?: string[] | null
          metadata_sync_status?: string | null
          nav_menu_excludes?: string[]
          nav_menu_includes?: string[]
          original_title?: string | null
          paraphrase_locked_at?: string | null
          paraphrase_status?: string
          platform?: string
          platform_details?: string | null
          product_type?: string | null
          publishers?: string[] | null
          region?: string
          regional_limitations?: string | null
          release_date?: string | null
          screenshots?: string[] | null
          slug?: string
          sold_count?: number
          steam_app_id?: string | null
          store?: string
          system_requirements?: Json | null
          tab_category?: string | null
          title?: string
          video_url?: string | null
          wishlist_count?: number
        }
        Relationships: []
      }
      blocked_kinguin_products: {
        Row: {
          blocked_by: string | null
          created_at: string
          id: string
          kinguin_product_id: string
          product_name: string
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          kinguin_product_id: string
          product_name: string
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          kinguin_product_id?: string
          product_name?: string
        }
        Relationships: []
      }
      bot_action_logs: {
        Row: {
          action_description: string
          action_type: string
          conversation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          input_data: Json | null
          output_data: Json | null
          status: string
        }
        Insert: {
          action_description: string
          action_type: string
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          status?: string
        }
        Update: {
          action_description?: string
          action_type?: string
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          status?: string
        }
        Relationships: []
      }
      brand_overrides: {
        Row: {
          brand_key: string
          created_at: string
          display_name: string | null
          id: string
          image_url: string | null
          image_zoom: number
          updated_at: string
        }
        Insert: {
          brand_key: string
          created_at?: string
          display_name?: string | null
          id?: string
          image_url?: string | null
          image_zoom?: number
          updated_at?: string
        }
        Update: {
          brand_key?: string
          created_at?: string
          display_name?: string | null
          id?: string
          image_url?: string | null
          image_zoom?: number
          updated_at?: string
        }
        Relationships: []
      }
      bundle_products: {
        Row: {
          allowed_product_id: string
          bundle_id: string
          created_at: string
          display_order: number
          id: string
        }
        Insert: {
          allowed_product_id: string
          bundle_id: string
          created_at?: string
          display_order?: number
          id?: string
        }
        Update: {
          allowed_product_id?: string
          bundle_id?: string
          created_at?: string
          display_order?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_products_allowed_product_id_fkey"
            columns: ["allowed_product_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_products_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      bundles: {
        Row: {
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      carousel_slots: {
        Row: {
          allowed_product_id: string
          id: string
          image_url: string
          slot_position: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_product_id: string
          id?: string
          image_url: string
          slot_position: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_product_id?: string
          id?: string
          image_url?: string
          slot_position?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      collection_products: {
        Row: {
          allowed_product_id: string
          collection_id: string
          created_at: string
          display_order: number
          id: string
        }
        Insert: {
          allowed_product_id: string
          collection_id: string
          created_at?: string
          display_order?: number
          id?: string
        }
        Update: {
          allowed_product_id?: string
          collection_id?: string
          created_at?: string
          display_order?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_products_allowed_product_id_fkey"
            columns: ["allowed_product_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          auto_group_keyword: string | null
          category_filter: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          target_page: string | null
          updated_at: string
        }
        Insert: {
          auto_group_keyword?: string | null
          category_filter?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          target_page?: string | null
          updated_at?: string
        }
        Update: {
          auto_group_keyword?: string | null
          category_filter?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          target_page?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          admin_note: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          status: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          status?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      cookie_consent_logs: {
        Row: {
          choice: string
          created_at: string
          id: string
          user_agent: string | null
        }
        Insert: {
          choice: string
          created_at?: string
          id?: string
          user_agent?: string | null
        }
        Update: {
          choice?: string
          created_at?: string
          id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      cron_health_status: {
        Row: {
          alert_sent_at: string | null
          consecutive_failures: number
          function_name: string
          last_checked_at: string | null
          last_error: string | null
          last_failure_at: string | null
          last_ok_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          alert_sent_at?: string | null
          consecutive_failures?: number
          function_name: string
          last_checked_at?: string | null
          last_error?: string | null
          last_failure_at?: string | null
          last_ok_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          alert_sent_at?: string | null
          consecutive_failures?: number
          function_name?: string
          last_checked_at?: string | null
          last_error?: string | null
          last_failure_at?: string | null
          last_ok_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_suggestions: {
        Row: {
          admin_note: string | null
          created_at: string
          email: string | null
          id: string
          message: string
          status: string
          subject: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message: string
          status?: string
          subject: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          status?: string
          subject?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      daily_deals: {
        Row: {
          allowed_product_id: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          original_price: number | null
          sale_price: number
          updated_at: string
        }
        Insert: {
          allowed_product_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          original_price?: number | null
          sale_price: number
          updated_at?: string
        }
        Update: {
          allowed_product_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          original_price?: number | null
          sale_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_deals_allowed_product_id_fkey"
            columns: ["allowed_product_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_proof_logs: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          device_fingerprint: string | null
          email: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          order_id: string
          phone: string | null
          revealed_at: string
          terms_accepted: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_fingerprint?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          order_id: string
          phone?: string | null
          revealed_at?: string
          terms_accepted?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_fingerprint?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          order_id?: string
          phone?: string | null
          revealed_at?: string
          terms_accepted?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      device_verification_codes: {
        Row: {
          code: string
          created_at: string
          device_fingerprint: string
          expires_at: string
          id: string
          used: boolean
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          device_fingerprint: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          device_fingerprint?: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          discount_type: string
          discount_value: number
          emailed_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_order_amount: number | null
          max_uses: number | null
          min_order_amount: number | null
          updated_at: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          discount_type?: string
          discount_value: number
          emailed_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_order_amount?: number | null
          max_uses?: number | null
          min_order_amount?: number | null
          updated_at?: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          discount_type?: string
          discount_value?: number
          emailed_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_order_amount?: number | null
          max_uses?: number | null
          min_order_amount?: number | null
          updated_at?: string
          used_count?: number
        }
        Relationships: []
      }
      duplicate_product_alerts: {
        Row: {
          clean_id: string
          detected_at: string
          id: string
          stuck_id: string
        }
        Insert: {
          clean_id: string
          detected_at?: string
          id?: string
          stuck_id: string
        }
        Update: {
          clean_id?: string
          detected_at?: string
          id?: string
          stuck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_product_alerts_clean_id_fkey"
            columns: ["clean_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_product_alerts_stuck_id_fkey"
            columns: ["stuck_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      email_verification_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          otp_code: string | null
          token: string
          used: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          otp_code?: string | null
          token: string
          used?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          otp_code?: string | null
          token?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      fraud_flags: {
        Row: {
          created_at: string
          description: string
          flag_type: string
          id: string
          metadata: Json | null
          resolution_note: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          flag_type: string
          id?: string
          metadata?: Json | null
          resolution_note?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          flag_type?: string
          id?: string
          metadata?: Json | null
          resolution_note?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_id?: string
        }
        Relationships: []
      }
      fraud_lists: {
        Row: {
          created_at: string
          created_by: string | null
          entry_type: string
          id: string
          list_type: string
          reason: string | null
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_type: string
          id?: string
          list_type: string
          reason?: string | null
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_type?: string
          id?: string
          list_type?: string
          reason?: string | null
          value?: string
        }
        Relationships: []
      }
      fraud_scores: {
        Row: {
          created_at: string
          id: string
          ipqs_score: number | null
          is_blocked: boolean
          last_flag_at: string | null
          last_purchase_at: string | null
          new_account_limit_cap: number | null
          new_account_limit_exempt: boolean
          new_account_limit_until: string | null
          notes: string | null
          risk_level: string
          risk_score: number
          total_chargebacks: number
          total_flags: number
          total_purchases: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ipqs_score?: number | null
          is_blocked?: boolean
          last_flag_at?: string | null
          last_purchase_at?: string | null
          new_account_limit_cap?: number | null
          new_account_limit_exempt?: boolean
          new_account_limit_until?: string | null
          notes?: string | null
          risk_level?: string
          risk_score?: number
          total_chargebacks?: number
          total_flags?: number
          total_purchases?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ipqs_score?: number | null
          is_blocked?: boolean
          last_flag_at?: string | null
          last_purchase_at?: string | null
          new_account_limit_cap?: number | null
          new_account_limit_exempt?: boolean
          new_account_limit_until?: string | null
          notes?: string | null
          risk_level?: string
          risk_score?: number
          total_chargebacks?: number
          total_flags?: number
          total_purchases?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      free_gift_claims: {
        Row: {
          allowed_product_id: string
          claimed_at: string
          id: string
          order_id: string | null
          paypal_order_id: string
          user_id: string
        }
        Insert: {
          allowed_product_id: string
          claimed_at?: string
          id?: string
          order_id?: string | null
          paypal_order_id: string
          user_id: string
        }
        Update: {
          allowed_product_id?: string
          claimed_at?: string
          id?: string
          order_id?: string | null
          paypal_order_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_gift_claims_allowed_product_id_fkey"
            columns: ["allowed_product_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
        ]
      }
      free_gift_products: {
        Row: {
          allowed_product_id: string
          created_at: string
          id: string
        }
        Insert: {
          allowed_product_id: string
          created_at?: string
          id?: string
        }
        Update: {
          allowed_product_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_gift_products_allowed_product_id_fkey"
            columns: ["allowed_product_id"]
            isOneToOne: true
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
        ]
      }
      free_gift_settings: {
        Row: {
          banner_enabled: boolean
          id: number
          updated_at: string
        }
        Insert: {
          banner_enabled?: boolean
          id?: number
          updated_at?: string
        }
        Update: {
          banner_enabled?: boolean
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      game_group_items: {
        Row: {
          allowed_product_id: string
          created_at: string
          display_order: number
          group_id: string
          id: string
          item_type: Database["public"]["Enums"]["game_item_type"]
        }
        Insert: {
          allowed_product_id: string
          created_at?: string
          display_order?: number
          group_id: string
          id?: string
          item_type?: Database["public"]["Enums"]["game_item_type"]
        }
        Update: {
          allowed_product_id?: string
          created_at?: string
          display_order?: number
          group_id?: string
          id?: string
          item_type?: Database["public"]["Enums"]["game_item_type"]
        }
        Relationships: [
          {
            foreignKeyName: "game_group_items_allowed_product_id_fkey"
            columns: ["allowed_product_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "game_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      game_groups: {
        Row: {
          base_product_id: string | null
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          base_product_id?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          base_product_id?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_groups_base_product_id_fkey"
            columns: ["base_product_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
        ]
      }
      game_leaderboard: {
        Row: {
          created_at: string
          game_type: string
          id: string
          score: number
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          game_type: string
          id?: string
          score?: number
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          game_type?: string
          id?: string
          score?: number
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      game_plays: {
        Row: {
          coins_won: number
          created_at: string
          game_type: string
          id: string
          is_paid: boolean
          user_id: string
        }
        Insert: {
          coins_won?: number
          created_at?: string
          game_type: string
          id?: string
          is_paid?: boolean
          user_id: string
        }
        Update: {
          coins_won?: number
          created_at?: string
          game_type?: string
          id?: string
          is_paid?: boolean
          user_id?: string
        }
        Relationships: []
      }
      geo_mention_checks: {
        Row: {
          checked_at: string
          competitors_mentioned: string[]
          full_response: string | null
          id: string
          mentioned: boolean
          model: string
          prompt_id: string | null
          prompt_text: string
          response_snippet: string | null
          sentiment: string | null
        }
        Insert: {
          checked_at?: string
          competitors_mentioned?: string[]
          full_response?: string | null
          id?: string
          mentioned: boolean
          model: string
          prompt_id?: string | null
          prompt_text: string
          response_snippet?: string | null
          sentiment?: string | null
        }
        Update: {
          checked_at?: string
          competitors_mentioned?: string[]
          full_response?: string | null
          id?: string
          mentioned?: boolean
          model?: string
          prompt_id?: string | null
          prompt_text?: string
          response_snippet?: string | null
          sentiment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geo_mention_checks_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "geo_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_prompts: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          prompt: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          prompt: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          prompt?: string
          updated_at?: string
        }
        Relationships: []
      }
      giveaway_bonus_awarded_orders: {
        Row: {
          awarded_at: string
          giveaway_id: string
          order_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          giveaway_id: string
          order_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          giveaway_id?: string
          order_id?: string
          user_id?: string
        }
        Relationships: []
      }
      giveaway_entries: {
        Row: {
          bonus_from_orders: number
          entry_count: number
          giveaway_id: string
          id: string
          is_fake: boolean
          joined_at: string
          updated_at: string
          user_email: string
          user_id: string
        }
        Insert: {
          bonus_from_orders?: number
          entry_count?: number
          giveaway_id: string
          id?: string
          is_fake?: boolean
          joined_at?: string
          updated_at?: string
          user_email: string
          user_id: string
        }
        Update: {
          bonus_from_orders?: number
          entry_count?: number
          giveaway_id?: string
          id?: string
          is_fake?: boolean
          joined_at?: string
          updated_at?: string
          user_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "giveaway_entries_giveaway_id_fkey"
            columns: ["giveaway_id"]
            isOneToOne: false
            referencedRelation: "giveaways"
            referencedColumns: ["id"]
          },
        ]
      }
      giveaway_prizes: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string | null
          email_sent_at: string | null
          email_status: string
          game_code: string
          giveaway_id: string
          id: string
          kinguin_order_id: string | null
          notes: string | null
          source: string
          updated_at: string
          winner_email: string
          winner_user_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          email_sent_at?: string | null
          email_status?: string
          game_code: string
          giveaway_id: string
          id?: string
          kinguin_order_id?: string | null
          notes?: string | null
          source: string
          updated_at?: string
          winner_email: string
          winner_user_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          email_sent_at?: string | null
          email_status?: string
          game_code?: string
          giveaway_id?: string
          id?: string
          kinguin_order_id?: string | null
          notes?: string | null
          source?: string
          updated_at?: string
          winner_email?: string
          winner_user_id?: string
        }
        Relationships: []
      }
      giveaways: {
        Row: {
          allowed_product_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          fake_entries_boost: number
          id: string
          predetermined_winner_email: string | null
          prize_count: number
          prize_image_url: string | null
          seeded_winners: Json
          starts_at: string
          status: string
          title: string
          updated_at: string
          winner_announced_at: string | null
          winner_email: string | null
          winner_user_id: string | null
        }
        Insert: {
          allowed_product_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          fake_entries_boost?: number
          id?: string
          predetermined_winner_email?: string | null
          prize_count?: number
          prize_image_url?: string | null
          seeded_winners?: Json
          starts_at?: string
          status?: string
          title: string
          updated_at?: string
          winner_announced_at?: string | null
          winner_email?: string | null
          winner_user_id?: string | null
        }
        Update: {
          allowed_product_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          fake_entries_boost?: number
          id?: string
          predetermined_winner_email?: string | null
          prize_count?: number
          prize_image_url?: string | null
          seeded_winners?: Json
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          winner_announced_at?: string | null
          winner_email?: string | null
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "giveaways_allowed_product_id_fkey"
            columns: ["allowed_product_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_articles: {
        Row: {
          category_id: string
          content: string
          created_at: string
          display_order: number
          excerpt: string | null
          id: string
          image_url: string | null
          is_published: boolean
          meta_description: string | null
          meta_title: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id: string
          content?: string
          created_at?: string
          display_order?: number
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          content?: string
          created_at?: string
          display_order?: number
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "guide_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      internal_secrets: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      ipqs_cache: {
        Row: {
          cache_key: string
          created_at: string
          data: Json
          expires_at: string
          id: string
          kind: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          data: Json
          expires_at: string
          id?: string
          kind: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          data?: Json
          expires_at?: string
          id?: string
          kind?: string
        }
        Relationships: []
      }
      kinguin_orders: {
        Row: {
          created_at: string
          game_key: string | null
          id: string
          kinguin_order_id: string
          kinguin_price: number
          kinguin_product_id: string
          order_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_key?: string | null
          id?: string
          kinguin_order_id: string
          kinguin_price: number
          kinguin_product_id: string
          order_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_key?: string | null
          id?: string
          kinguin_order_id?: string
          kinguin_price?: number
          kinguin_product_id?: string
          order_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kinguin_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      kinguin_product_suggestions: {
        Row: {
          admin_edited: boolean
          admin_note: string | null
          category: string
          created_at: string
          discovered_at: string
          id: string
          image_url: string | null
          kinguin_price: number | null
          kinguin_product_id: string
          metadata: Json | null
          platform: string | null
          region: string | null
          release_date: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          store: string | null
          title: string
        }
        Insert: {
          admin_edited?: boolean
          admin_note?: string | null
          category?: string
          created_at?: string
          discovered_at?: string
          id?: string
          image_url?: string | null
          kinguin_price?: number | null
          kinguin_product_id: string
          metadata?: Json | null
          platform?: string | null
          region?: string | null
          release_date?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store?: string | null
          title: string
        }
        Update: {
          admin_edited?: boolean
          admin_note?: string | null
          category?: string
          created_at?: string
          discovered_at?: string
          id?: string
          image_url?: string | null
          kinguin_price?: number | null
          kinguin_product_id?: string
          metadata?: Json | null
          platform?: string | null
          region?: string | null
          release_date?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store?: string | null
          title?: string
        }
        Relationships: []
      }
      kinguin_products: {
        Row: {
          allowed_product_id: string
          created_at: string
          id: string
          is_active: boolean
          is_overpriced: boolean
          kinguin_price: number | null
          kinguin_product_id: string
          kinguin_stock: number | null
          last_change_at: string | null
          last_change_source: string | null
          last_change_summary: string | null
          last_stock_check: string | null
          last_webhook_update: string | null
          overpriced_marked_at: string | null
          sell_price: number
          updated_at: string
        }
        Insert: {
          allowed_product_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_overpriced?: boolean
          kinguin_price?: number | null
          kinguin_product_id: string
          kinguin_stock?: number | null
          last_change_at?: string | null
          last_change_source?: string | null
          last_change_summary?: string | null
          last_stock_check?: string | null
          last_webhook_update?: string | null
          overpriced_marked_at?: string | null
          sell_price: number
          updated_at?: string
        }
        Update: {
          allowed_product_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_overpriced?: boolean
          kinguin_price?: number | null
          kinguin_product_id?: string
          kinguin_stock?: number | null
          last_change_at?: string | null
          last_change_source?: string | null
          last_change_summary?: string | null
          last_stock_check?: string | null
          last_webhook_update?: string | null
          overpriced_marked_at?: string | null
          sell_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kinguin_products_allowed_product_id_fkey"
            columns: ["allowed_product_id"]
            isOneToOne: true
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
        ]
      }
      kinguin_sync_runs: {
        Row: {
          batch_size: number
          created_at: string
          deactivated: number
          duration_ms: number | null
          error_message: string | null
          expired: number
          finished_at: string | null
          id: string
          mode: string
          price_changed: number
          reactivated: number
          skipped: number
          started_at: string
          status: string
          total_processed: number
          updated: number
        }
        Insert: {
          batch_size?: number
          created_at?: string
          deactivated?: number
          duration_ms?: number | null
          error_message?: string | null
          expired?: number
          finished_at?: string | null
          id?: string
          mode?: string
          price_changed?: number
          reactivated?: number
          skipped?: number
          started_at?: string
          status?: string
          total_processed?: number
          updated?: number
        }
        Update: {
          batch_size?: number
          created_at?: string
          deactivated?: number
          duration_ms?: number | null
          error_message?: string | null
          expired?: number
          finished_at?: string | null
          id?: string
          mode?: string
          price_changed?: number
          reactivated?: number
          skipped?: number
          started_at?: string
          status?: string
          total_processed?: number
          updated?: number
        }
        Relationships: []
      }
      live_chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          content: string
          created_at: string
          edited: boolean
          id: string
          request_id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          content: string
          created_at?: string
          edited?: boolean
          id?: string
          request_id: string
          sender_id: string
          sender_role: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          content?: string
          created_at?: string
          edited?: boolean
          id?: string
          request_id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "live_support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      live_chat_typing: {
        Row: {
          id: string
          is_typing: boolean
          request_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          is_typing?: boolean
          request_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          is_typing?: boolean
          request_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_typing_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "live_support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      live_support_requests: {
        Row: {
          buyer_last_seen_at: string | null
          created_at: string
          id: string
          initiated_by: string
          last_buyer_notify_at: string | null
          status: string
          updated_at: string
          user_email: string
          user_id: string
        }
        Insert: {
          buyer_last_seen_at?: string | null
          created_at?: string
          id?: string
          initiated_by?: string
          last_buyer_notify_at?: string | null
          status?: string
          updated_at?: string
          user_email: string
          user_id: string
        }
        Update: {
          buyer_last_seen_at?: string | null
          created_at?: string
          id?: string
          initiated_by?: string
          last_buyer_notify_at?: string | null
          status?: string
          updated_at?: string
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      live_support_settings: {
        Row: {
          disabled_message: string | null
          id: number
          is_enabled: boolean
          override_mode: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          disabled_message?: string | null
          id?: number
          is_enabled?: boolean
          override_mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          disabled_message?: string | null
          id?: number
          is_enabled?: boolean
          override_mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          from_email: string
          from_name: string
          html_content: string
          id: string
          preview_text: string | null
          recipient_filter: Json
          sent_at: string | null
          status: string
          subject: string
          total_failed: number
          total_recipients: number
          total_sent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_email?: string
          from_name?: string
          html_content: string
          id?: string
          preview_text?: string | null
          recipient_filter?: Json
          sent_at?: string | null
          status?: string
          subject: string
          total_failed?: number
          total_recipients?: number
          total_sent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_email?: string
          from_name?: string
          html_content?: string
          id?: string
          preview_text?: string | null
          recipient_filter?: Json
          sent_at?: string | null
          status?: string
          subject?: string
          total_failed?: number
          total_recipients?: number
          total_sent?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketing_send_log: {
        Row: {
          campaign_id: string
          created_at: string
          error_message: string | null
          id: string
          recipient_email: string
          resend_id: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_email: string
          resend_id?: string | null
          status: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          resend_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_send_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_unsubscribes: {
        Row: {
          email: string
          id: string
          reason: string | null
          unsubscribed_at: string
        }
        Insert: {
          email: string
          id?: string
          reason?: string | null
          unsubscribed_at?: string
        }
        Update: {
          email?: string
          id?: string
          reason?: string | null
          unsubscribed_at?: string
        }
        Relationships: []
      }
      nav_menu_items: {
        Row: {
          created_at: string
          display_order: number
          filter_keywords: string[]
          href: string
          id: string
          is_visible: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          filter_keywords?: string[]
          href: string
          id?: string
          is_visible?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          filter_keywords?: string[]
          href?: string
          id?: string
          is_visible?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nav_menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "nav_menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          author_name: string
          category_id: string
          content: string
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          is_published: boolean
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          published_at: string | null
          scheduled_publish_at: string | null
          slug: string
          tags: string[]
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_name?: string
          category_id: string
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          published_at?: string | null
          scheduled_publish_at?: string | null
          slug: string
          tags?: string[]
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_name?: string
          category_id?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          published_at?: string | null
          scheduled_publish_at?: string | null
          slug?: string
          tags?: string[]
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "news_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "news_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      news_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      news_related_products: {
        Row: {
          allowed_product_id: string
          article_id: string
          created_at: string
          display_order: number
          id: string
        }
        Insert: {
          allowed_product_id: string
          article_id: string
          created_at?: string
          display_order?: number
          id?: string
        }
        Update: {
          allowed_product_id?: string
          article_id?: string
          created_at?: string
          display_order?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_related_products_allowed_product_id_fkey"
            columns: ["allowed_product_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_related_products_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      order_id_verifications: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          order_id: string
          uploader_ip: string | null
          uploader_user_agent: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          order_id: string
          uploader_ip?: string | null
          uploader_user_agent?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          order_id?: string
          uploader_ip?: string | null
          uploader_user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_id_verifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_invoices: {
        Row: {
          amount: number
          created_at: string
          currency_code: number
          doc_no: string
          doc_type: number
          id: string
          is_test: boolean
          order_id: string
          pdf_copy: string | null
          pdf_english: string | null
          pdf_original: string | null
          raw_response: Json | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency_code?: number
          doc_no: string
          doc_type?: number
          id?: string
          is_test?: boolean
          order_id: string
          pdf_copy?: string | null
          pdf_english?: string | null
          pdf_original?: string | null
          raw_response?: Json | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency_code?: number
          doc_no?: string
          doc_type?: number
          id?: string
          is_test?: boolean
          order_id?: string
          pdf_copy?: string | null
          pdf_english?: string | null
          pdf_original?: string | null
          raw_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "order_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_refunds: {
        Row: {
          admin_note: string | null
          amount: number | null
          created_at: string
          currency: string
          id: string
          order_id: string
          paypal_capture_id: string | null
          paypal_order_id: string | null
          paypal_refund_id: string | null
          reason: string | null
          refund_type: string
          refunded_at: string
          refunded_by: string
          status: string
        }
        Insert: {
          admin_note?: string | null
          amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          order_id: string
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          paypal_refund_id?: string | null
          reason?: string | null
          refund_type?: string
          refunded_at?: string
          refunded_by: string
          status?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          paypal_refund_id?: string | null
          reason?: string | null
          refund_type?: string
          refunded_at?: string
          refunded_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          access_token: string | null
          aliexpress_order_id: string | null
          approved_at: string | null
          approved_by: string | null
          buyer_city: string | null
          buyer_country: string | null
          carrier_name: string | null
          code_delivered: boolean | null
          code_viewed_at: string | null
          codes_viewed: boolean
          created_at: string
          game_code: string | null
          game_title: string
          guest_access_token: string | null
          guest_email: string | null
          guest_phone: string | null
          held_reason: string | null
          held_until: string | null
          id: string
          id_proof_token: string | null
          id_proof_token_expires_at: string | null
          image_url: string | null
          ip_address: string | null
          is_held: boolean
          paypal_order_id: string | null
          paypal_payer_snapshot: Json | null
          pending_kinguin: Json | null
          platform: string
          price: number
          quantity: number
          review_invite_sent_at: string | null
          review_reward_sent_at: string | null
          shipped_at: string | null
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_full_name: string | null
          shipping_phone: string | null
          shipping_state: string | null
          shipping_zip_code: string | null
          status: string
          tracking_number: string | null
          tracking_url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          aliexpress_order_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          buyer_city?: string | null
          buyer_country?: string | null
          carrier_name?: string | null
          code_delivered?: boolean | null
          code_viewed_at?: string | null
          codes_viewed?: boolean
          created_at?: string
          game_code?: string | null
          game_title: string
          guest_access_token?: string | null
          guest_email?: string | null
          guest_phone?: string | null
          held_reason?: string | null
          held_until?: string | null
          id?: string
          id_proof_token?: string | null
          id_proof_token_expires_at?: string | null
          image_url?: string | null
          ip_address?: string | null
          is_held?: boolean
          paypal_order_id?: string | null
          paypal_payer_snapshot?: Json | null
          pending_kinguin?: Json | null
          platform: string
          price: number
          quantity?: number
          review_invite_sent_at?: string | null
          review_reward_sent_at?: string | null
          shipped_at?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_full_name?: string | null
          shipping_phone?: string | null
          shipping_state?: string | null
          shipping_zip_code?: string | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          aliexpress_order_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          buyer_city?: string | null
          buyer_country?: string | null
          carrier_name?: string | null
          code_delivered?: boolean | null
          code_viewed_at?: string | null
          codes_viewed?: boolean
          created_at?: string
          game_code?: string | null
          game_title?: string
          guest_access_token?: string | null
          guest_email?: string | null
          guest_phone?: string | null
          held_reason?: string | null
          held_until?: string | null
          id?: string
          id_proof_token?: string | null
          id_proof_token_expires_at?: string | null
          image_url?: string | null
          ip_address?: string | null
          is_held?: boolean
          paypal_order_id?: string | null
          paypal_payer_snapshot?: Json | null
          pending_kinguin?: Json | null
          platform?: string
          price?: number
          quantity?: number
          review_invite_sent_at?: string | null
          review_reward_sent_at?: string | null
          shipped_at?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_full_name?: string | null
          shipping_phone?: string | null
          shipping_state?: string | null
          shipping_zip_code?: string | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      overpriced_card_scans: {
        Row: {
          created_at: string
          face_currency: string
          face_value: number
          face_value_eur: number
          id: string
          is_active: boolean
          kinguin_price: number | null
          kinguin_product_row_id: string | null
          kinguin_stock: number | null
          product_id: string
          scan_batch_id: string
          sell_price: number
          sell_vs_face_ratio: number
          title: string
        }
        Insert: {
          created_at?: string
          face_currency: string
          face_value: number
          face_value_eur: number
          id?: string
          is_active?: boolean
          kinguin_price?: number | null
          kinguin_product_row_id?: string | null
          kinguin_stock?: number | null
          product_id: string
          scan_batch_id: string
          sell_price: number
          sell_vs_face_ratio: number
          title: string
        }
        Update: {
          created_at?: string
          face_currency?: string
          face_value?: number
          face_value_eur?: number
          id?: string
          is_active?: boolean
          kinguin_price?: number | null
          kinguin_product_row_id?: string | null
          kinguin_stock?: number | null
          product_id?: string
          scan_batch_id?: string
          sell_price?: number
          sell_vs_face_ratio?: number
          title?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          page_path: string
          referrer: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page_path: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page_path?: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      paraphrase_queue: {
        Row: {
          allowed_product_id: string
          batch_id: string
          created_at: string
          error: string | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          allowed_product_id: string
          batch_id?: string
          created_at?: string
          error?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          allowed_product_id?: string
          batch_id?: string
          created_at?: string
          error?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paraphrase_queue_allowed_product_id_fkey"
            columns: ["allowed_product_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_proposals: {
        Row: {
          company_industry: string
          created_at: string
          email: string
          id: string
          job_title: string
          proposal: string
          representative_name: string
          status: string
          strategic_goals: string[]
          updated_at: string
        }
        Insert: {
          company_industry: string
          created_at?: string
          email: string
          id?: string
          job_title: string
          proposal: string
          representative_name: string
          status?: string
          strategic_goals?: string[]
          updated_at?: string
        }
        Update: {
          company_industry?: string
          created_at?: string
          email?: string
          id?: string
          job_title?: string
          proposal?: string
          representative_name?: string
          status?: string
          strategic_goals?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      payment_health_alerts: {
        Row: {
          alerted_at: string
          attempts: number | null
          details: string | null
          fulfilled: number | null
          id: string
          signature: string
        }
        Insert: {
          alerted_at?: string
          attempts?: number | null
          details?: string | null
          fulfilled?: number | null
          id?: string
          signature: string
        }
        Update: {
          alerted_at?: string
          attempts?: number | null
          details?: string | null
          fulfilled?: number | null
          id?: string
          signature?: string
        }
        Relationships: []
      }
      payment_processors: {
        Row: {
          created_at: string
          display_order: number
          fee_fixed: number
          fee_pct: number
          id: string
          is_active: boolean
          label: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          fee_fixed?: number
          fee_pct?: number
          id?: string
          is_active?: boolean
          label: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          fee_fixed?: number
          fee_pct?: number
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pending_paypal_orders: {
        Row: {
          applied_coupon: Json | null
          charge_currency: string
          created_at: string
          fulfilled_at: string | null
          guest_email: string | null
          guest_phone: string | null
          guest_session_id: string | null
          id: string
          items: Json
          last_error: string | null
          payment_source_detail: string | null
          payment_source_type: string | null
          paypal_order_id: string | null
          paypal_payer_snapshot: Json | null
          redeem_coins: number
          selected_shipping: Json | null
          shipping_address: Json | null
          status: string
          total_charge: number
          total_eur: number
          updated_at: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          applied_coupon?: Json | null
          charge_currency?: string
          created_at?: string
          fulfilled_at?: string | null
          guest_email?: string | null
          guest_phone?: string | null
          guest_session_id?: string | null
          id?: string
          items: Json
          last_error?: string | null
          payment_source_detail?: string | null
          payment_source_type?: string | null
          paypal_order_id?: string | null
          paypal_payer_snapshot?: Json | null
          redeem_coins?: number
          selected_shipping?: Json | null
          shipping_address?: Json | null
          status?: string
          total_charge: number
          total_eur: number
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          applied_coupon?: Json | null
          charge_currency?: string
          created_at?: string
          fulfilled_at?: string | null
          guest_email?: string | null
          guest_phone?: string | null
          guest_session_id?: string | null
          id?: string
          items?: Json
          last_error?: string | null
          payment_source_detail?: string | null
          payment_source_type?: string | null
          paypal_order_id?: string | null
          paypal_payer_snapshot?: Json | null
          redeem_coins?: number
          selected_shipping?: Json | null
          shipping_address?: Json | null
          status?: string
          total_charge?: number
          total_eur?: number
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      play_purchases: {
        Row: {
          amount_paid: number
          created_at: string
          id: string
          paypal_order_id: string | null
          plays_bought: number
          plays_remaining: number
          user_id: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          id?: string
          paypal_order_id?: string | null
          plays_bought?: number
          plays_remaining?: number
          user_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          id?: string
          paypal_order_id?: string | null
          plays_bought?: number
          plays_remaining?: number
          user_id?: string
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          created_at: string
          id: string
          margin_pct: number
          max_cost: number
          tier_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          margin_pct: number
          max_cost: number
          tier_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          margin_pct?: number
          max_cost?: number
          tier_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_rules_topups: {
        Row: {
          created_at: string
          id: string
          margin_pct: number
          max_cost: number
          tier_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          margin_pct: number
          max_cost: number
          tier_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          margin_pct?: number
          max_cost?: number
          tier_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          fixed_fee: number
          id: number
          platform_pct: number
          updated_at: string
        }
        Insert: {
          fixed_fee?: number
          id?: number
          platform_pct?: number
          updated_at?: string
        }
        Update: {
          fixed_fee?: number
          id?: number
          platform_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      privacy_opt_out: {
        Row: {
          created_at: string
          email: string
          id: string
          note: string | null
          source: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          note?: string | null
          source?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          note?: string | null
          source?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      product_keys: {
        Row: {
          added_at: string
          allowed_product_id: string | null
          created_at: string
          id: string
          key_code: string
          order_id: string | null
          product_id: string | null
          seller_id: string
          sold_at: string | null
          status: string
        }
        Insert: {
          added_at?: string
          allowed_product_id?: string | null
          created_at?: string
          id?: string
          key_code: string
          order_id?: string | null
          product_id?: string | null
          seller_id: string
          sold_at?: string | null
          status?: string
        }
        Update: {
          added_at?: string
          allowed_product_id?: string | null
          created_at?: string
          id?: string
          key_code?: string
          order_id?: string | null
          product_id?: string | null
          seller_id?: string
          sold_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_keys_allowed_product_id_fkey"
            columns: ["allowed_product_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_keys_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_keys_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_keys_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          description: string | null
          id: string
          platform: string
          region: string
          requested_by: string
          status: string
          store: string
          title: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          description?: string | null
          id?: string
          platform?: string
          region?: string
          requested_by: string
          status?: string
          store?: string
          title: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          description?: string | null
          id?: string
          platform?: string
          region?: string
          requested_by?: string
          status?: string
          store?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_variations: {
        Row: {
          allowed_product_id: string
          created_at: string
          id: string
          image_url: string | null
          price: number | null
          sku_attr: string | null
          sku_id: string
          stock: number | null
          variation_name: string
        }
        Insert: {
          allowed_product_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          price?: number | null
          sku_attr?: string | null
          sku_id: string
          stock?: number | null
          variation_name?: string
        }
        Update: {
          allowed_product_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          price?: number | null
          sku_attr?: string | null
          sku_id?: string
          stock?: number | null
          variation_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variations_allowed_product_id_fkey"
            columns: ["allowed_product_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          game_code: string | null
          id: string
          image_url: string | null
          low_stock_alert: boolean
          low_stock_threshold: number
          original_price: number | null
          platform: string
          price: number
          price_change_alert: boolean
          seller_id: string
          status: string
          store: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          game_code?: string | null
          id?: string
          image_url?: string | null
          low_stock_alert?: boolean
          low_stock_threshold?: number
          original_price?: number | null
          platform: string
          price: number
          price_change_alert?: boolean
          seller_id: string
          status?: string
          store: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          game_code?: string | null
          id?: string
          image_url?: string | null
          low_stock_alert?: boolean
          low_stock_threshold?: number
          original_price?: number | null
          platform?: string
          price?: number
          price_change_alert?: boolean
          seller_id?: string
          status?: string
          store?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          address: string | null
          avatar_url: string | null
          city: string | null
          cooling_period_email_attempts: number
          cooling_period_email_sent: boolean
          country: string | null
          created_at: string
          display_name: string | null
          email_verified: boolean
          fake_sales_boost: number
          id: string
          phone: string | null
          referred_by_code: string | null
          state: string | null
          suspended_at: string | null
          updated_at: string
          user_id: string
          username: string | null
          verification_reminder_24h_sent: boolean
          verification_reminder_48h_sent: boolean
          zip_code: string | null
        }
        Insert: {
          account_status?: string
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          cooling_period_email_attempts?: number
          cooling_period_email_sent?: boolean
          country?: string | null
          created_at?: string
          display_name?: string | null
          email_verified?: boolean
          fake_sales_boost?: number
          id?: string
          phone?: string | null
          referred_by_code?: string | null
          state?: string | null
          suspended_at?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
          verification_reminder_24h_sent?: boolean
          verification_reminder_48h_sent?: boolean
          zip_code?: string | null
        }
        Update: {
          account_status?: string
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          cooling_period_email_attempts?: number
          cooling_period_email_sent?: boolean
          country?: string | null
          created_at?: string
          display_name?: string | null
          email_verified?: boolean
          fake_sales_boost?: number
          id?: string
          phone?: string | null
          referred_by_code?: string | null
          state?: string | null
          suspended_at?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
          verification_reminder_24h_sent?: boolean
          verification_reminder_48h_sent?: boolean
          zip_code?: string | null
        }
        Relationships: []
      }
      purchase_otp_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          guest_session_id: string | null
          id: string
          phone: string
          used: boolean
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          guest_session_id?: string | null
          id?: string
          phone: string
          used?: boolean
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          guest_session_id?: string | null
          id?: string
          phone?: string
          used?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      quantity_discounts: {
        Row: {
          created_at: string
          discount_pct: number
          id: string
          is_active: boolean
          label: string | null
          min_quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_pct: number
          id?: string
          is_active?: boolean
          label?: string | null
          min_quantity: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_pct?: number
          id?: string
          is_active?: boolean
          label?: string | null
          min_quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          country: string | null
          created_at: string
          endpoint: string
          event_count: number
          id: string
          ip_address: string
          method: string
          user_agent: string | null
          user_id: string | null
          was_blocked: boolean
          window_start: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          endpoint: string
          event_count?: number
          id?: string
          ip_address: string
          method?: string
          user_agent?: string | null
          user_id?: string | null
          was_blocked?: boolean
          window_start?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          endpoint?: string
          event_count?: number
          id?: string
          ip_address?: string
          method?: string
          user_agent?: string | null
          user_id?: string | null
          was_blocked?: boolean
          window_start?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          total_coins_earned: number
          total_referrals: number
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          total_coins_earned?: number
          total_referrals?: number
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          total_coins_earned?: number
          total_referrals?: number
          user_id?: string
        }
        Relationships: []
      }
      referral_completions: {
        Row: {
          coins_awarded: number
          created_at: string
          id: string
          referred_user_id: string
          referrer_id: string
          trigger_order_id: string | null
        }
        Insert: {
          coins_awarded?: number
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_id: string
          trigger_order_id?: string | null
        }
        Update: {
          coins_awarded?: number
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_id?: string
          trigger_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_completions_trigger_order_id_fkey"
            columns: ["trigger_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_giveaway_awards: {
        Row: {
          created_at: string
          entries_awarded: number
          giveaway_id: string
          id: string
          referred_user_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string
          entries_awarded?: number
          giveaway_id: string
          id?: string
          referred_user_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string
          entries_awarded?: number
          giveaway_id?: string
          id?: string
          referred_user_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_giveaway_awards_giveaway_id_fkey"
            columns: ["giveaway_id"]
            isOneToOne: false
            referencedRelation: "giveaways"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          allowed_product_id: string | null
          buyer_id: string
          comment: string
          created_at: string
          id: string
          order_id: string | null
          rating_product: number
          rating_service: number
          rating_shipping: number
          seller_id: string
          seller_responded_at: string | null
          seller_response: string | null
        }
        Insert: {
          allowed_product_id?: string | null
          buyer_id: string
          comment: string
          created_at?: string
          id?: string
          order_id?: string | null
          rating_product: number
          rating_service: number
          rating_shipping: number
          seller_id: string
          seller_responded_at?: string | null
          seller_response?: string | null
        }
        Update: {
          allowed_product_id?: string | null
          buyer_id?: string
          comment?: string
          created_at?: string
          id?: string
          order_id?: string | null
          rating_product?: number
          rating_service?: number
          rating_shipping?: number
          seller_id?: string
          seller_responded_at?: string | null
          seller_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_allowed_product_id_fkey"
            columns: ["allowed_product_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      search_logs: {
        Row: {
          created_at: string
          id: string
          page_path: string | null
          query: string
          results_count: number
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page_path?: string | null
          query: string
          results_count?: number
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page_path?: string | null
          query?: string
          results_count?: number
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      seller_applications: {
        Row: {
          admin_note: string | null
          business_document_url: string | null
          business_name: string | null
          country: string
          created_at: string
          email: string
          experience: string | null
          full_name: string
          id: string
          id_document_url: string | null
          phone: string | null
          product_types: string
          selfie_url: string | null
          status: string
          supplier_receipts_urls: string[] | null
          updated_at: string
          user_id: string
          why_sell: string | null
        }
        Insert: {
          admin_note?: string | null
          business_document_url?: string | null
          business_name?: string | null
          country: string
          created_at?: string
          email: string
          experience?: string | null
          full_name: string
          id?: string
          id_document_url?: string | null
          phone?: string | null
          product_types: string
          selfie_url?: string | null
          status?: string
          supplier_receipts_urls?: string[] | null
          updated_at?: string
          user_id: string
          why_sell?: string | null
        }
        Update: {
          admin_note?: string | null
          business_document_url?: string | null
          business_name?: string | null
          country?: string
          created_at?: string
          email?: string
          experience?: string | null
          full_name?: string
          id?: string
          id_document_url?: string | null
          phone?: string | null
          product_types?: string
          selfie_url?: string | null
          status?: string
          supplier_receipts_urls?: string[] | null
          updated_at?: string
          user_id?: string
          why_sell?: string | null
        }
        Relationships: []
      }
      seller_notification_preferences: {
        Row: {
          created_at: string
          id: string
          low_stock_alert: boolean
          low_stock_threshold: number
          price_change_alert: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          low_stock_alert?: boolean
          low_stock_threshold?: number
          price_change_alert?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          low_stock_alert?: boolean
          low_stock_threshold?: number
          price_change_alert?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      seller_payment_accounts: {
        Row: {
          created_at: string
          id: string
          payoneer_email: string | null
          paypal_email: string | null
          seller_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          payoneer_email?: string | null
          paypal_email?: string | null
          seller_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          payoneer_email?: string | null
          paypal_email?: string | null
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      seller_sales: {
        Row: {
          available_at: string
          commission_amount: number
          commission_rate: number
          created_at: string
          id: string
          net_earnings: number
          order_id: string | null
          order_number: number
          platform: string
          product_title: string
          sale_amount: number
          seller_id: string
          status: string
        }
        Insert: {
          available_at?: string
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          net_earnings?: number
          order_id?: string | null
          order_number?: number
          platform?: string
          product_title: string
          sale_amount?: number
          seller_id: string
          status?: string
        }
        Update: {
          available_at?: string
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          net_earnings?: number
          order_id?: string | null
          order_number?: number
          platform?: string
          product_title?: string
          sale_amount?: number
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_sales_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_articles: {
        Row: {
          content: string
          created_at: string | null
          excerpt: string | null
          id: string
          image_url: string | null
          slug: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          excerpt?: string | null
          id?: string
          image_url?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          excerpt?: string | null
          id?: string
          image_url?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      seo_audit_findings: {
        Row: {
          created_at: string
          details: Json
          id: string
          issue_code: string
          message: string
          page_type: string
          run_id: string
          severity: string
          url: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          issue_code: string
          message: string
          page_type?: string
          run_id: string
          severity: string
          url: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          issue_code?: string
          message?: string
          page_type?: string
          run_id?: string
          severity?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_audit_findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "seo_audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_audit_runs: {
        Row: {
          critical_count: number
          error: string | null
          finished_at: string | null
          id: string
          info_count: number
          pages_checked: number
          score: number | null
          started_at: string
          status: string
          triggered_by: string | null
          warning_count: number
        }
        Insert: {
          critical_count?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          info_count?: number
          pages_checked?: number
          score?: number | null
          started_at?: string
          status?: string
          triggered_by?: string | null
          warning_count?: number
        }
        Update: {
          critical_count?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          info_count?: number
          pages_checked?: number
          score?: number | null
          started_at?: string
          status?: string
          triggered_by?: string | null
          warning_count?: number
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          abuseipdb_enabled: boolean
          email_provider: string
          hide_giveaway_winner: boolean | null
          id: number
          ipqs_enabled: boolean
          maintenance_mode: boolean
          maintenance_until: string | null
          proxycheck_enabled: boolean
          receipts_enabled: boolean
          updated_at: string
        }
        Insert: {
          abuseipdb_enabled?: boolean
          email_provider?: string
          hide_giveaway_winner?: boolean | null
          id?: number
          ipqs_enabled?: boolean
          maintenance_mode?: boolean
          maintenance_until?: string | null
          proxycheck_enabled?: boolean
          receipts_enabled?: boolean
          updated_at?: string
        }
        Update: {
          abuseipdb_enabled?: boolean
          email_provider?: string
          hide_giveaway_winner?: boolean | null
          id?: number
          ipqs_enabled?: boolean
          maintenance_mode?: boolean
          maintenance_until?: string | null
          proxycheck_enabled?: boolean
          receipts_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      stock_notifications: {
        Row: {
          allowed_product_id: string
          created_at: string
          email: string
          id: string
          notified: boolean
        }
        Insert: {
          allowed_product_id: string
          created_at?: string
          email: string
          id?: string
          notified?: boolean
        }
        Update: {
          allowed_product_id?: string
          created_at?: string
          email?: string
          id?: string
          notified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "stock_notifications_allowed_product_id_fkey"
            columns: ["allowed_product_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_note: string | null
          buyer_email: string
          buyer_id: string | null
          created_at: string
          id: string
          is_guest: boolean
          issue_type: string
          message: string
          order_id: string | null
          resolution_type: string | null
          screenshot_url: string | null
          seller_id: string | null
          seller_response: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          buyer_email: string
          buyer_id?: string | null
          created_at?: string
          id?: string
          is_guest?: boolean
          issue_type: string
          message: string
          order_id?: string | null
          resolution_type?: string | null
          screenshot_url?: string | null
          seller_id?: string | null
          seller_response?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          buyer_email?: string
          buyer_id?: string | null
          created_at?: string
          id?: string
          is_guest?: boolean
          issue_type?: string
          message?: string
          order_id?: string | null
          resolution_type?: string | null
          screenshot_url?: string | null
          seller_id?: string | null
          seller_response?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      title_correction_rules: {
        Row: {
          created_at: string
          created_by: string | null
          example_new: string | null
          example_old: string | null
          hits: number
          id: string
          is_active: boolean
          pattern: string
          replacement: string
          type_hint: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          example_new?: string | null
          example_old?: string | null
          hits?: number
          id?: string
          is_active?: boolean
          pattern: string
          replacement: string
          type_hint?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          example_new?: string | null
          example_old?: string | null
          hits?: number
          id?: string
          is_active?: boolean
          pattern?: string
          replacement?: string
          type_hint?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trusted_devices: {
        Row: {
          created_at: string
          device_fingerprint: string
          device_name: string | null
          id: string
          last_used_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint: string
          device_name?: string | null
          id?: string
          last_used_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string
          device_name?: string | null
          id?: string
          last_used_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          reward_claimed: boolean
          reward_metadata: Json | null
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          reward_claimed?: boolean
          reward_metadata?: Json | null
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          reward_claimed?: boolean
          reward_metadata?: Json | null
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_coins: {
        Row: {
          balance: number
          created_at: string
          id: string
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wholesale_inquiries: {
        Row: {
          business_address: string
          company_name: string
          contact_email: string
          created_at: string
          id: string
          monthly_order_volume: string
          sales_channels: string
          status: string
          tax_id: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          business_address: string
          company_name: string
          contact_email: string
          created_at?: string
          id?: string
          monthly_order_volume: string
          sales_channels?: string
          status?: string
          tax_id?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          business_address?: string
          company_name?: string
          contact_email?: string
          created_at?: string
          id?: string
          monthly_order_volume?: string
          sales_channels?: string
          status?: string
          tax_id?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      wishlist: {
        Row: {
          allowed_product_id: string | null
          created_at: string
          game_title: string
          id: string
          image_url: string | null
          last_price_drop_notified_at: string | null
          last_restock_notified_at: string | null
          notify_price_drops: boolean
          notify_restock: boolean
          platform: string
          price: number | null
          price_at_add: number | null
          user_id: string
        }
        Insert: {
          allowed_product_id?: string | null
          created_at?: string
          game_title: string
          id?: string
          image_url?: string | null
          last_price_drop_notified_at?: string | null
          last_restock_notified_at?: string | null
          notify_price_drops?: boolean
          notify_restock?: boolean
          platform: string
          price?: number | null
          price_at_add?: number | null
          user_id: string
        }
        Update: {
          allowed_product_id?: string | null
          created_at?: string
          game_title?: string
          id?: string
          image_url?: string | null
          last_price_drop_notified_at?: string | null
          last_restock_notified_at?: string | null
          notify_price_drops?: boolean
          notify_restock?: boolean
          platform?: string
          price?: number | null
          price_at_add?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_allowed_product_id_fkey"
            columns: ["allowed_product_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          method: string
          payoneer_email: string | null
          paypal_email: string | null
          seller_id: string
          seller_seen: boolean
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          method?: string
          payoneer_email?: string | null
          paypal_email?: string | null
          seller_id: string
          seller_seen?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          method?: string
          payoneer_email?: string | null
          paypal_email?: string | null
          seller_id?: string
          seller_seen?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      product_reviews_public: {
        Row: {
          allowed_product_id: string | null
          comment: string | null
          created_at: string | null
          id: string | null
          rating_product: number | null
          rating_service: number | null
          rating_shipping: number | null
          reviewer_name: string | null
          seller_responded_at: string | null
          seller_response: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_allowed_product_id_fkey"
            columns: ["allowed_product_id"]
            isOneToOne: false
            referencedRelation: "allowed_products"
            referencedColumns: ["id"]
          },
        ]
      }
      products_public: {
        Row: {
          category: string | null
          created_at: string | null
          id: string | null
          image_url: string | null
          original_price: number | null
          platform: string | null
          price: number | null
          seller_id: string | null
          status: string | null
          stock_count: number | null
          store: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          original_price?: number | null
          platform?: string | null
          price?: number | null
          seller_id?: string | null
          status?: string | null
          stock_count?: never
          store?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string | null
          image_url?: string | null
          original_price?: number | null
          platform?: string | null
          price?: number | null
          seller_id?: string | null
          status?: string | null
          stock_count?: never
          store?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      reviews_public: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string | null
          order_id: string | null
          rating_product: number | null
          rating_service: number | null
          rating_shipping: number | null
          seller_id: string | null
          seller_responded_at: string | null
          seller_response: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string | null
          order_id?: string | null
          rating_product?: number | null
          rating_service?: number | null
          rating_shipping?: number | null
          seller_id?: string | null
          seller_responded_at?: string | null
          seller_response?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string | null
          order_id?: string | null
          rating_product?: number | null
          rating_service?: number | null
          rating_shipping?: number | null
          seller_id?: string | null
          seller_responded_at?: string | null
          seller_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_coins: {
        Args: { _amount: number; _game_play_id: string; _user_id: string }
        Returns: undefined
      }
      admin_list_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          jobid: number
          jobname: string
          schedule: string
        }[]
      }
      admin_toggle_cron_job: {
        Args: { _active: boolean; _jobname: string }
        Returns: undefined
      }
      admin_update_cron_schedule: {
        Args: { _jobname: string; _schedule: string }
        Returns: undefined
      }
      attach_referral_code: {
        Args: { _code: string; _user_id: string }
        Returns: boolean
      }
      award_referral_giveaway_entries: {
        Args: {
          _entries?: number
          _referred_user_id: string
          _referrer_id: string
        }
        Returns: boolean
      }
      buy_plays_with_coins: { Args: { _user_id: string }; Returns: boolean }
      check_email_exists: { Args: { _email: string }; Returns: boolean }
      check_my_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      classify_and_tag_products: {
        Args: never
        Returns: {
          label: string
          updated: number
        }[]
      }
      cleanup_old_rate_limit_events: { Args: never; Returns: number }
      complete_referral: {
        Args: { _coins?: number; _order_id: string; _referred_user_id: string }
        Returns: boolean
      }
      consume_play: { Args: { _user_id: string }; Returns: boolean }
      create_guest_support_ticket: {
        Args: {
          _email: string
          _issue_type: string
          _message: string
          _order_id: string
          _screenshot_url: string
        }
        Returns: string
      }
      delete_allowed_products_bulk: {
        Args: { product_ids: string[] }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_all_unparaphrased: { Args: never; Returns: number }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      find_stuck_preorder_duplicates: {
        Args: never
        Returns: {
          clean_id: string
          clean_title: string
          stuck_id: string
          stuck_title: string
        }[]
      }
      generate_achievement_coupon_code: {
        Args: { p_prefix: string }
        Returns: string
      }
      generate_product_slug: {
        Args: { p_region: string; p_store: string; p_title: string }
        Returns: string
      }
      get_free_gift_claim_counts: {
        Args: never
        Returns: {
          allowed_product_id: string
          claim_count: number
        }[]
      }
      get_frequently_bought_together: {
        Args: { _limit?: number; _platform: string; _product_title: string }
        Returns: {
          id: string
          image_url: string
          platform: string
          region: string
          slug: string
          sold_count: number
          store: string
          title: string
        }[]
      }
      get_giveaway_entry_stats: {
        Args: { _giveaway_id: string }
        Returns: {
          participant_count: number
          total_entries: number
        }[]
      }
      get_guest_order:
        | {
            Args: { _access_token: string; _paypal_order_id: string }
            Returns: Json[]
          }
        | {
            Args: { p_order_id: string; p_token: string }
            Returns: {
              access_token: string | null
              aliexpress_order_id: string | null
              approved_at: string | null
              approved_by: string | null
              buyer_city: string | null
              buyer_country: string | null
              carrier_name: string | null
              code_delivered: boolean | null
              code_viewed_at: string | null
              codes_viewed: boolean
              created_at: string
              game_code: string | null
              game_title: string
              guest_access_token: string | null
              guest_email: string | null
              guest_phone: string | null
              held_reason: string | null
              held_until: string | null
              id: string
              id_proof_token: string | null
              id_proof_token_expires_at: string | null
              image_url: string | null
              ip_address: string | null
              is_held: boolean
              paypal_order_id: string | null
              paypal_payer_snapshot: Json | null
              pending_kinguin: Json | null
              platform: string
              price: number
              quantity: number
              review_invite_sent_at: string | null
              review_reward_sent_at: string | null
              shipped_at: string | null
              shipping_address_line1: string | null
              shipping_address_line2: string | null
              shipping_city: string | null
              shipping_country: string | null
              shipping_full_name: string | null
              shipping_phone: string | null
              shipping_state: string | null
              shipping_zip_code: string | null
              status: string
              tracking_number: string | null
              tracking_url: string | null
              user_agent: string | null
              user_id: string | null
            }[]
            SetofOptions: {
              from: "*"
              to: "orders"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: { p_paypal_order_id: string; p_token: string }
            Returns: {
              access_token: string | null
              aliexpress_order_id: string | null
              approved_at: string | null
              approved_by: string | null
              buyer_city: string | null
              buyer_country: string | null
              carrier_name: string | null
              code_delivered: boolean | null
              code_viewed_at: string | null
              codes_viewed: boolean
              created_at: string
              game_code: string | null
              game_title: string
              guest_access_token: string | null
              guest_email: string | null
              guest_phone: string | null
              held_reason: string | null
              held_until: string | null
              id: string
              id_proof_token: string | null
              id_proof_token_expires_at: string | null
              image_url: string | null
              ip_address: string | null
              is_held: boolean
              paypal_order_id: string | null
              paypal_payer_snapshot: Json | null
              pending_kinguin: Json | null
              platform: string
              price: number
              quantity: number
              review_invite_sent_at: string | null
              review_reward_sent_at: string | null
              shipped_at: string | null
              shipping_address_line1: string | null
              shipping_address_line2: string | null
              shipping_city: string | null
              shipping_country: string | null
              shipping_full_name: string | null
              shipping_phone: string | null
              shipping_state: string | null
              shipping_zip_code: string | null
              status: string
              tracking_number: string | null
              tracking_url: string | null
              user_agent: string | null
              user_id: string | null
            }[]
            SetofOptions: {
              from: "*"
              to: "orders"
              isOneToOne: false
              isSetofReturn: true
            }
          }
      get_manual_key_counts: {
        Args: never
        Returns: {
          allowed_product_id: string
          key_count: number
        }[]
      }
      get_my_block_status: {
        Args: never
        Returns: {
          is_blocked: boolean
          reason: string
        }[]
      }
      get_product_rating_stats: {
        Args: { _product_id: string }
        Returns: {
          avg_rating: number
          rating_1: number
          rating_2: number
          rating_3: number
          rating_4: number
          rating_5: number
          review_count: number
        }[]
      }
      get_public_active_giveaway: {
        Args: never
        Returns: {
          allowed_product_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          fake_entries_boost: number
          id: string
          predetermined_winner_email: string | null
          prize_count: number
          prize_image_url: string | null
          seeded_winners: Json
          starts_at: string
          status: string
          title: string
          updated_at: string
          winner_announced_at: string | null
          winner_email: string | null
          winner_user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "giveaways"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_public_kinguin_by_ids: {
        Args: { _ids: string[] }
        Returns: {
          allowed_product_id: string
          id: string
          is_active: boolean
          kinguin_stock: number
          sell_price: number
        }[]
      }
      get_public_kinguin_products: {
        Args: never
        Returns: {
          allowed_product_id: string
          id: string
          is_active: boolean
          kinguin_stock: number
          sell_price: number
        }[]
      }
      get_public_kinguin_single: {
        Args: { _allowed_product_id: string }
        Returns: {
          allowed_product_id: string
          id: string
          is_active: boolean
          kinguin_stock: number
          sell_price: number
        }[]
      }
      get_public_latest_winner: {
        Args: never
        Returns: {
          allowed_product_id: string
          ends_at: string
          id: string
          prize_image_url: string
          title: string
          winner_announced_at: string
          winner_email: string
          winner_entry_count: number
        }[]
      }
      get_public_leaderboard: {
        Args: { _game_type?: string; _limit?: number }
        Returns: {
          created_at: string
          game_type: string
          id: string
          score: number
          username: string
        }[]
      }
      get_public_past_winners: {
        Args: { _limit?: number }
        Returns: {
          allowed_product_id: string
          ends_at: string
          id: string
          prize_image_url: string
          title: string
          winner_announced_at: string
          winner_display: string
        }[]
      }
      get_public_product_variations: {
        Args: { _allowed_product_id: string }
        Returns: {
          allowed_product_id: string
          id: string
          image_url: string
          price: number
          sku_attr: string
          sku_id: string
          stock: number
          variation_name: string
        }[]
      }
      get_public_reviews: {
        Args: { _limit?: number; _seller_id: string }
        Returns: {
          buyer_avatar_url: string
          buyer_display_name: string
          comment: string
          created_at: string
          id: string
          rating_product: number
          rating_service: number
          rating_shipping: number
          seller_response: string
        }[]
      }
      get_public_site_flags: {
        Args: never
        Returns: {
          maintenance_mode: boolean
          maintenance_until: string
          receipts_enabled: boolean
        }[]
      }
      get_public_variation_stock: {
        Args: { _allowed_product_ids: string[] }
        Returns: {
          allowed_product_id: string
          price: number
          stock: number
        }[]
      }
      get_seller_avg_ratings: {
        Args: { _seller_id: string }
        Returns: {
          avg_overall: number
          avg_product: number
          avg_service: number
          avg_shipping: number
          review_count: number
        }[]
      }
      get_seller_for_order: { Args: { _order_id: string }; Returns: string }
      get_seller_tickets: {
        Args: never
        Returns: {
          buyer_email: string
          buyer_id: string
          created_at: string
          id: string
          issue_type: string
          message: string
          order_id: string
          resolution_type: string
          screenshot_url: string
          seller_id: string
          seller_response: string
          status: string
          updated_at: string
        }[]
      }
      get_top_pages: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          last_visit: string
          page_path: string
          unique_visitors: number
          view_count: number
        }[]
      }
      get_users_for_verification_reminder: {
        Args: { _window: string }
        Returns: {
          created_at: string
          email: string
          user_id: string
        }[]
      }
      get_wishlist_count: { Args: { _game_title: string }; Returns: number }
      get_wishlist_counts_batch: {
        Args: { _game_titles: string[] }
        Returns: {
          game_title: string
          wishlist_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_coupon_usage: {
        Args: { _coupon_id: string }
        Returns: undefined
      }
      increment_sold_count: {
        Args: { _product_id: string; _qty: number }
        Returns: undefined
      }
      is_giveaway_open: { Args: { _giveaway_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      mark_order_viewed: { Args: { _order_id: string }; Returns: undefined }
      mark_verification_reminder_sent: {
        Args: { _user_id: string; _window: string }
        Returns: undefined
      }
      mark_withdrawal_seen: {
        Args: { _withdrawal_id: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notify_telegram: {
        Args: { _message: string; _meta?: Json; _title: string; _type: string }
        Returns: undefined
      }
      profile_sensitive_unchanged: {
        Args: {
          _account_status: string
          _email_verified: boolean
          _fake_sales_boost: number
          _profile_id: string
          _referred_by_code: string
          _suspended_at: string
        }
        Returns: boolean
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalculate_all_sell_prices: { Args: never; Returns: undefined }
      recalculate_user_achievements: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      record_play: {
        Args: { _game_type: string }
        Returns: {
          play_id: string
          used_paid: boolean
        }[]
      }
      request_withdrawal: {
        Args: { _amount: number; _email: string; _method: string }
        Returns: string
      }
      reset_stuck_paraphrasing: { Args: never; Returns: number }
      reveal_order_codes: {
        Args: { _access_token?: string; _paypal_order_id: string }
        Returns: {
          game_code: string
          id: string
        }[]
      }
      search_products_with_metadata: {
        Args: { _words: string[] }
        Returns: {
          aliexpress_product_id: string | null
          badges: string[] | null
          created_at: string
          description: string | null
          description_paraphrased: boolean
          developers: string[] | null
          expiration_date: string | null
          id: string
          image_url: string | null
          languages: string[] | null
          metadata_sync_status: string | null
          nav_menu_excludes: string[]
          nav_menu_includes: string[]
          original_title: string | null
          paraphrase_locked_at: string | null
          paraphrase_status: string
          platform: string
          platform_details: string | null
          product_type: string | null
          publishers: string[] | null
          region: string
          regional_limitations: string | null
          release_date: string | null
          screenshots: string[] | null
          slug: string
          sold_count: number
          steam_app_id: string | null
          store: string
          system_requirements: Json | null
          tab_category: string | null
          title: string
          video_url: string | null
          wishlist_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "allowed_products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      seller_respond_to_review: {
        Args: { _response: string; _review_id: string }
        Returns: undefined
      }
      spend_coins: {
        Args: { _amount: number; _user_id: string }
        Returns: boolean
      }
      strip_preorder_from_slug: { Args: { _slug: string }; Returns: string }
      strip_preorder_from_title: { Args: { _title: string }; Returns: string }
      submit_game_score: {
        Args: { _game_play_id: string; _username: string }
        Returns: undefined
      }
      suspend_unverified_accounts: { Args: never; Returns: number }
      validate_discount_code: {
        Args: { _code: string; _order_total: number }
        Returns: Json
      }
      verify_email_token: { Args: { _token: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "seller" | "user" | "super_admin"
      game_item_type: "base" | "dlc" | "skin" | "currency" | "edition"
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
      app_role: ["admin", "seller", "user", "super_admin"],
      game_item_type: ["base", "dlc", "skin", "currency", "edition"],
    },
  },
} as const
