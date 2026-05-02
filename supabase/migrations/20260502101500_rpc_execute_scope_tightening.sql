revoke execute on function public.accept_invitation() from authenticated;
grant execute on function public.accept_invitation() to service_role;

revoke execute on function public.submit_access_request(text, text, text, text, integer) from authenticated;
grant execute on function public.submit_access_request(text, text, text, text, integer) to anon, service_role;
