-- 0008_request_expiry — server-side sweep of lapsed evidence requests.
--
-- A request "lapses" when it is still in a non-terminal status (DRAFT / SENT /
-- IN_PROGRESS) but has no access grant that is both unrevoked and unexpired.
-- The transition to EXPIRED runs across every tenant in one pass, so it lives
-- in a SECURITY DEFINER function owned by the schema owner. The function also
-- writes the audit event and the outbox notification for each affected request,
-- inside the same transaction, so the state change and its trail commit
-- together. `rre_app` may EXECUTE it but gains no other cross-tenant visibility.

CREATE FUNCTION expire_lapsed_requests(at timestamptz, max_rows integer)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    UPDATE evidence_request er
       SET status = 'EXPIRED'
     WHERE er.id IN (
       SELECT e.id
         FROM evidence_request e
        WHERE e.status IN ('DRAFT', 'SENT', 'IN_PROGRESS')
          AND NOT EXISTS (
            SELECT 1 FROM access_token_grant g
             WHERE g.request_id = e.id
               AND g.revoked_at IS NULL
               AND g.expires_at > at
          )
        ORDER BY e.seq
        LIMIT max_rows
        FOR UPDATE SKIP LOCKED
     )
    RETURNING er.id, er.tenant_id, er.entity_id
  LOOP
    INSERT INTO audit_event
      (id, tenant_id, actor_type, actor_id, action, target_type, target_id, occurred_at, metadata)
    VALUES
      ('aud_' || gen_random_uuid(), r.tenant_id, 'system', 'expiry-sweep',
       'request.expired', 'evidence_request', r.id, at,
       jsonb_build_object('entityId', r.entity_id));

    INSERT INTO outbox (id, tenant_id, topic, payload)
    VALUES
      ('obx_' || gen_random_uuid(), r.tenant_id, 'request.expired',
       jsonb_build_object('requestId', r.id, 'entityId', r.entity_id));

    n := n + 1;
  END LOOP;

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION expire_lapsed_requests(timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION expire_lapsed_requests(timestamptz, integer) TO rre_app;
