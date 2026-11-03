-- Close the Sanad verification workflow without allowing user-supplied
-- references to mark an account verified or one user's submission to affect
-- another user's records. This migration is intentionally additive/idempotent.
BEGIN;

CREATE OR REPLACE FUNCTION public.app_submit_sanad_verification(
  p_user_id uuid,
  p_provider_reference text,
  p_document_reference text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record_id uuid;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
    AND NOT EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = p_user_id
        AND (u.auth_user_id = auth.uid() OR u.id = auth.uid())
    ) THEN
    RAISE EXCEPTION 'Not authorized to submit verification for this user'
      USING ERRCODE = '42501';
  END IF;

  IF p_provider_reference IS NULL
    OR length(btrim(p_provider_reference)) < 6
    OR length(p_provider_reference) > 120
    OR (p_document_reference IS NOT NULL AND length(p_document_reference) > 120) THEN
    RAISE EXCEPTION 'Invalid verification reference' USING ERRCODE = '22023';
  END IF;

  -- Serialize submissions for a user so concurrent retries cannot open two
  -- pending reviews. The advisory lock is transaction scoped.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.verification_records vr
    WHERE vr.user_id = p_user_id
      AND vr.sanad_status = 'pending'
      AND vr.provider_reference IS NOT NULL
      AND vr.provider_reference <> 'driver_documents'
  ) THEN
    RAISE EXCEPTION 'An identity verification is already pending'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.verification_records (
    user_id, sanad_status, document_status, verification_level,
    provider_reference, document_reference, failure_reason
  ) VALUES (
    p_user_id, 'pending',
    CASE WHEN nullif(btrim(p_document_reference), '') IS NULL THEN 'unverified'::verification_status_v2 ELSE 'pending'::verification_status_v2 END,
    'level_1', btrim(p_provider_reference), nullif(btrim(p_document_reference), ''), NULL
  ) RETURNING verification_id INTO v_record_id;

  UPDATE public.users
  SET sanad_verified_status = 'pending', updated_at = timezone('utc', now())
  WHERE id = p_user_id;

  RETURN v_record_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_review_sanad_verification(
  p_verification_id uuid,
  p_verified boolean,
  p_admin_id uuid,
  p_failure_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only the trusted application server may review identity submissions'
      USING ERRCODE = '42501';
  END IF;
  IF p_verified IS NULL OR p_admin_id IS NULL
    OR (NOT p_verified AND (length(btrim(coalesce(p_failure_reason, ''))) < 5 OR length(p_failure_reason) > 500)) THEN
    RAISE EXCEPTION 'Invalid identity review decision' USING ERRCODE = '22023';
  END IF;

  UPDATE public.verification_records
  SET sanad_status = CASE WHEN p_verified THEN 'verified'::verification_status_v2 ELSE 'rejected'::verification_status_v2 END,
      document_status = CASE WHEN p_verified AND document_reference IS NOT NULL THEN 'verified'::verification_status_v2 ELSE document_status END,
      verification_level = CASE WHEN p_verified THEN 'level_2'::verification_level_v2 ELSE verification_level END,
      verification_timestamp = timezone('utc', now()),
      reviewer_admin_id = p_admin_id,
      failure_reason = CASE WHEN p_verified THEN NULL ELSE btrim(p_failure_reason) END,
      updated_at = timezone('utc', now())
  WHERE verification_id = p_verification_id
    AND sanad_status = 'pending'
    AND provider_reference IS DISTINCT FROM 'driver_documents'
  RETURNING user_id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Identity submission is not pending' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.users u
  SET sanad_verified_status = CASE WHEN p_verified THEN 'verified'::verification_status_v2 ELSE 'rejected'::verification_status_v2 END,
      verification_level = CASE
        WHEN NOT p_verified THEN u.verification_level
        WHEN u.verification_level = 'level_3' THEN 'level_3'::verification_level_v2
        ELSE 'level_2'::verification_level_v2
      END,
      updated_at = timezone('utc', now())
  WHERE u.id = v_user_id;

  RETURN p_verification_id;
END;
$$;

-- Preserve the legacy function signature but limit it to the newest pending
-- Sanad row instead of updating every verification record belonging to a user.
CREATE OR REPLACE FUNCTION public.app_complete_sanad_verification(
  p_user_id uuid,
  p_verified boolean,
  p_admin_id uuid DEFAULT NULL,
  p_failure_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_verification_id uuid;
BEGIN
  SELECT verification_id INTO v_verification_id
  FROM public.verification_records
  WHERE user_id = p_user_id
    AND sanad_status = 'pending'
    AND provider_reference IS DISTINCT FROM 'driver_documents'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF v_verification_id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN public.app_review_sanad_verification(
    v_verification_id, p_verified, p_admin_id, p_failure_reason
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.app_submit_sanad_verification(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_submit_sanad_verification(uuid, text, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.app_complete_sanad_verification(uuid, boolean, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_complete_sanad_verification(uuid, boolean, uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.app_review_sanad_verification(uuid, boolean, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_review_sanad_verification(uuid, boolean, uuid, text) TO service_role;

COMMIT;
