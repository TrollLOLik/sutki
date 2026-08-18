CREATE TABLE admin_sanction (
  id bigserial PRIMARY KEY,
  report_id bigint NOT NULL REFERENCES abuse_report(id) ON DELETE RESTRICT,
  sanction_type varchar(32) NOT NULL
    CHECK (sanction_type IN ('reject_listing', 'hide_review', 'hide_message', 'disable_user')),
  target_type varchar(16) NOT NULL
    CHECK (target_type IN ('listing', 'review', 'message', 'user')),
  target_id bigint NOT NULL CHECK (target_id > 0),
  subject_user_id integer REFERENCES "user"(id) ON DELETE SET NULL,
  previous_state jsonb NOT NULL,
  applied_by_admin_id bigint NOT NULL REFERENCES admin_account(id) ON DELETE RESTRICT,
  applied_reason text NOT NULL CHECK (char_length(applied_reason) BETWEEN 1 AND 2000),
  applied_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by_admin_id bigint REFERENCES admin_account(id) ON DELETE RESTRICT,
  revoke_reason text CHECK (revoke_reason IS NULL OR char_length(revoke_reason) BETWEEN 1 AND 2000),
  CHECK (
    (revoked_at IS NULL AND revoked_by_admin_id IS NULL AND revoke_reason IS NULL)
    OR
    (revoked_at IS NOT NULL AND revoked_by_admin_id IS NOT NULL AND revoke_reason IS NOT NULL)
  )
);

CREATE UNIQUE INDEX admin_sanction_active_target_idx
  ON admin_sanction(sanction_type, target_type, target_id)
  WHERE revoked_at IS NULL;

CREATE INDEX admin_sanction_report_idx
  ON admin_sanction(report_id, applied_at DESC, id DESC);

CREATE INDEX admin_sanction_subject_user_idx
  ON admin_sanction(subject_user_id, applied_at DESC, id DESC)
  WHERE subject_user_id IS NOT NULL;
