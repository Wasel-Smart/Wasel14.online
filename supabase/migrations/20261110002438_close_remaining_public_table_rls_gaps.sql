-- Close tables that were left outside RLS or had RLS with no policy.
-- Client access remains limited to the small set with explicit grants below;
-- operational and financial tables are service-role only.

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corridor_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_restrictions ENABLE ROW LEVEL SECURITY;

-- Explicit service-role policies document the trusted server boundary.
CREATE POLICY analytics_events_service_role_all ON public.analytics_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY api_logs_service_role_all ON public.api_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY audit_logs_service_role_all ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY backup_logs_service_role_all ON public.backup_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY business_accounts_service_role_all ON public.business_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY campaigns_service_role_all ON public.campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY chat_media_service_role_all ON public.chat_media FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY corridor_analytics_service_role_all ON public.corridor_analytics FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY demand_forecasts_service_role_all ON public.demand_forecasts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY devices_service_role_all ON public.devices FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY disputes_service_role_all ON public.disputes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY driver_payouts_service_role_all ON public.driver_payouts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY driver_status_history_service_role_all ON public.driver_status_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY error_logs_service_role_all ON public.error_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY health_checks_service_role_all ON public.health_checks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY loyalty_points_service_role_all ON public.loyalty_points FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY loyalty_transactions_service_role_all ON public.loyalty_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY pricing_rules_service_role_all ON public.pricing_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY processed_stripe_events_service_role_all ON public.processed_stripe_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY promo_codes_service_role_all ON public.promo_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY push_tokens_service_role_all ON public.push_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY referrals_service_role_all ON public.referrals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY student_verifications_service_role_all ON public.student_verifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY system_alerts_service_role_all ON public.system_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY trip_analytics_service_role_all ON public.trip_analytics FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY typing_indicators_service_role_all ON public.typing_indicators FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY universities_service_role_all ON public.universities FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY api_rate_limits_service_role_all ON public.api_rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY config_audit_log_service_role_all ON public.config_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY conversations_service_role_all ON public.conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY country_feature_flags_service_role_all ON public.country_feature_flags FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY country_services_service_role_all ON public.country_services FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY driver_documents_service_role_all ON public.driver_documents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY pricing_zones_service_role_all ON public.pricing_zones FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY refunds_service_role_all ON public.refunds FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY route_restrictions_service_role_all ON public.route_restrictions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- These tables already have explicit authenticated grants. Scope user-owned
-- device/token rows to the authenticated profile and keep event insertion
-- attributable to the caller (anonymous events may use a NULL user_id).
CREATE POLICY devices_owner_all ON public.devices
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY push_tokens_owner_all ON public.push_tokens
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY analytics_events_insert_own ON public.analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = (SELECT auth.uid()));

CREATE POLICY universities_active_read ON public.universities
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY country_services_enabled_read ON public.country_services
  FOR SELECT TO authenticated
  USING (enabled = true);

CREATE POLICY country_feature_flags_enabled_read ON public.country_feature_flags
  FOR SELECT TO authenticated
  USING (enabled = true);
