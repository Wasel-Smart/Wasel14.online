revoke all on function public.cleanup_expired_idempotency_keys() from public, anon, authenticated;
grant execute on function public.cleanup_expired_idempotency_keys() to service_role;;
