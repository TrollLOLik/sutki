-- name: GetConversationByParticipantsAndHouse :one
-- 1. Поиск диалога привязанного к объекту (house_id IS NOT NULL)
SELECT c.id
FROM conversation c
JOIN conversation_participant cp1 ON c.id = cp1.conversation_id
JOIN conversation_participant cp2 ON c.id = cp2.conversation_id
WHERE c.house_id = $1
  AND cp1.user_id = $2
  AND cp2.user_id = $3
  AND cp1.user_id <> cp2.user_id
LIMIT 1;

-- name: GetConversationByParticipantsGeneral :one
-- 2. Поиск общего диалога между пользователями (house_id IS NULL)
SELECT c.id
FROM conversation c
JOIN conversation_participant cp1 ON c.id = cp1.conversation_id
JOIN conversation_participant cp2 ON c.id = cp2.conversation_id
WHERE c.house_id IS NULL
  AND cp1.user_id = $1
  AND cp2.user_id = $2
  AND cp1.user_id <> cp2.user_id
LIMIT 1;

-- name: CreateConversation :one
INSERT INTO conversation (house_id, created_at, updated_at)
VALUES ($1, now(), now())
RETURNING id, house_id, created_at, updated_at;

-- name: AddConversationParticipant :exec
INSERT INTO conversation_participant (conversation_id, user_id, last_read_at, last_read_message_id)
VALUES ($1, $2, now(), 0);

-- name: RegisterChatUpload :exec
INSERT INTO chat_upload (object_key, owner_id, size_bytes, mime_type)
VALUES (
  sqlc.arg(object_key),
  sqlc.arg(owner_id),
  sqlc.arg(size_bytes),
  sqlc.arg(mime_type)
);

-- name: CheckChatUploadOwnership :one
SELECT COUNT(*) = cardinality(sqlc.arg(object_keys)::text[]) AS owned
FROM chat_upload
WHERE owner_id = sqlc.arg(owner_id)::int
  AND object_key = ANY(sqlc.arg(object_keys)::text[]);

-- name: GetChatUploads :many
SELECT object_key, owner_id, size_bytes, mime_type, sealed_key, content_etag, created_at
FROM chat_upload
WHERE owner_id = sqlc.arg(owner_id)::int
  AND object_key = ANY(sqlc.arg(object_keys)::text[])
ORDER BY object_key;

-- name: SealChatUpload :one
UPDATE chat_upload
SET sealed_key = sqlc.arg(sealed_key),
    content_etag = sqlc.arg(content_etag)
WHERE object_key = sqlc.arg(object_key)
  AND owner_id = sqlc.arg(owner_id)::int
  AND (
    sealed_key IS NULL OR
    (sealed_key = sqlc.arg(sealed_key) AND content_etag = sqlc.arg(content_etag))
  )
RETURNING object_key;

-- name: CreateMessage :one
INSERT INTO message (conversation_id, sender_id, body, reply_to_message_id, created_at)
VALUES ($1, $2, $3, $4, now())
RETURNING id, conversation_id, sender_id, body, reply_to_message_id, created_at;

-- name: CreateAttachment :one
WITH owned_upload AS (
  -- Record authoritative S3 metadata and lock the upload row until the
  -- surrounding message transaction commits.
  UPDATE chat_upload
  SET size_bytes = COALESCE(sqlc.narg(size_bytes), chat_upload.size_bytes),
      mime_type = COALESCE(sqlc.narg(mime_type), chat_upload.mime_type)
  WHERE object_key = sqlc.arg(upload_key)
    AND owner_id = sqlc.arg(owner_id)::int
    AND sealed_key = sqlc.arg(url)
    AND content_etag IS NOT NULL
  RETURNING object_key
)
INSERT INTO message_attachment (
  message_id, url, file_name, mime_type, size_bytes, width, height,
  moderation_status, duration_seconds, thumbnail_url, upload_key
)
SELECT
  sqlc.arg(message_id),
  sqlc.arg(url),
  sqlc.narg(file_name),
  sqlc.narg(mime_type),
  sqlc.narg(size_bytes),
  sqlc.narg(width),
  sqlc.narg(height),
  sqlc.arg(moderation_status),
  sqlc.narg(duration_seconds),
  sqlc.narg(thumbnail_url),
  owned_upload.object_key
FROM owned_upload
RETURNING id, message_id, url, file_name, mime_type, size_bytes, width, height,
          moderation_status, duration_seconds, thumbnail_url;

-- name: UpdateConversationTimestamp :exec
UPDATE conversation
SET updated_at = now()
WHERE id = $1;

-- name: ListUserConversations :many
-- Тянет последнее сообщение с Фолбэком для медиа-вложений (превью в списке диалогов)
SELECT 
    c.id AS conversation_id,
    c.house_id,
    c.updated_at AS last_activity,
    cp.last_read_message_id,
    other_cp.last_read_message_id AS other_last_read_message_id,
    (
        SELECT COUNT(*)
        FROM message unread_m
        WHERE unread_m.conversation_id = c.id
          AND unread_m.id > cp.last_read_message_id
          AND (
            unread_m.sender_id = cp.user_id
            OR unread_m.sender_id IS NULL
            OR (
              NOT EXISTS (
                SELECT 1 FROM message_attachment pending_ma
                WHERE pending_ma.message_id = unread_m.id
                  AND pending_ma.moderation_status IN ('pending', 'failed')
              )
              AND (
                NOT EXISTS (
                  SELECT 1 FROM message_attachment any_ma
                  WHERE any_ma.message_id = unread_m.id
                )
                OR EXISTS (
                  SELECT 1 FROM message_attachment approved_ma
                  WHERE approved_ma.message_id = unread_m.id
                    AND approved_ma.moderation_status = 'approved'
                )
              )
            )
          )
    ) AS unread_count,
    m.id AS last_message_id,
    CASE
        WHEN m.deleted_at IS NOT NULL THEN 'Сообщение удалено'
        WHEN m.sender_id = cp.user_id
          AND EXISTS (
            SELECT 1 FROM message_attachment rejected_ma
            WHERE rejected_ma.message_id = m.id
              AND rejected_ma.moderation_status IN ('rejected', 'failed')
          )
          AND NOT EXISTS (
            SELECT 1 FROM message_attachment approved_ma
            WHERE approved_ma.message_id = m.id
              AND approved_ma.moderation_status = 'approved'
          )
          THEN COALESCE(m.body, '[Вложение не отправлено]')
        ELSE COALESCE(m.body, (
            SELECT CASE
                -- Альбом: показываем количество, а не «[Изображение]» —
                -- иначе отправка десяти фото в списке выглядит как одно.
                WHEN COUNT(*) FILTER (WHERE ma.mime_type LIKE 'image/%') > 1
                    THEN '[Фото: ' || COUNT(*) FILTER (WHERE ma.mime_type LIKE 'image/%') || ']'
                WHEN COUNT(*) FILTER (WHERE ma.mime_type LIKE 'image/%') = 1
                    THEN '[Изображение]'
                ELSE '[Документ]: ' || COALESCE(MIN(ma.file_name), '')
            END
            FROM message_attachment ma
            WHERE ma.message_id = m.id
              AND ma.moderation_status = 'approved'
        ), '')
    END::text AS last_message_body,
    m.sender_id AS last_message_sender_id,
    m.created_at AS last_message_created_at,
    other_u.id AS other_user_id,
    other_u.name AS other_user_name,
    other_u.surname AS other_user_surname,
    other_u.avatar_url AS other_user_avatar_url,
    other_u.phone AS other_user_phone,
    other_u.deleted AS other_user_deleted,
    h.street AS house_street,
    h.house_number AS house_number,
    h.count_room AS house_count_room,
    h.price AS house_price,
    COALESCE((
        SELECT f.path
        FROM file f
        WHERE f.house_id = h.id AND f.deleted = false
        ORDER BY f.position
        LIMIT 1
    ), '')::text AS house_cover_path
FROM conversation c
JOIN conversation_participant cp ON c.id = cp.conversation_id
JOIN conversation_participant other_cp ON c.id = other_cp.conversation_id AND other_cp.user_id <> cp.user_id
JOIN "user" other_u ON other_cp.user_id = other_u.id
LEFT JOIN house h ON c.house_id = h.id
LEFT JOIN message m ON m.conversation_id = c.id AND m.id = (
    SELECT MAX(candidate.id)
    FROM message candidate
    WHERE candidate.conversation_id = c.id
      AND (
        candidate.sender_id = cp.user_id
        OR candidate.sender_id IS NULL
        OR (
          NOT EXISTS (
            SELECT 1 FROM message_attachment pending_ma
            WHERE pending_ma.message_id = candidate.id
              AND pending_ma.moderation_status IN ('pending', 'failed')
          )
          AND (
            NOT EXISTS (
              SELECT 1 FROM message_attachment any_ma
              WHERE any_ma.message_id = candidate.id
            )
            OR EXISTS (
              SELECT 1 FROM message_attachment approved_ma
              WHERE approved_ma.message_id = candidate.id
                AND approved_ma.moderation_status = 'approved'
            )
          )
        )
      )
)
WHERE cp.user_id = $1
ORDER BY c.updated_at DESC;

-- name: GetConversationMessages :many
SELECT id, conversation_id, sender_id, body, reply_to_message_id, edited_at, deleted_at, created_at
FROM message
WHERE conversation_id = $1
  AND ($2::bigint = 0 OR id < $2)
ORDER BY id DESC
LIMIT $3;

-- name: GetMessageAttachments :many
SELECT id, message_id, url, file_name, mime_type, size_bytes, width, height,
       moderation_status, moderation_reason, duration_seconds, thumbnail_url
FROM message_attachment
WHERE message_id = ANY($1::bigint[]);

-- name: GetMessageQuotes :many
-- Компактные данные процитированных сообщений для гидрации реплаев.
-- Тело обрезается в SQL: цитата рендерится одной-двумя строками, и тащить
-- полные 4000 символов на каждую страницу истории незачем.
-- Первое вложение берётся коррелированным подзапросом по возрастанию id —
-- нужен только превью-URL, а не весь список.
SELECT
    m.id,
    m.sender_id,
    m.kind,
    m.deleted_at,
    LEFT(COALESCE(m.body, ''), sqlc.arg(preview_limit)::int)::text AS body_preview,
    (
        SELECT COUNT(*)
        FROM message_attachment ma
        WHERE ma.message_id = m.id
          AND ma.moderation_status = 'approved'
    ) AS attachment_count,
    COALESCE((
        SELECT ma.url
        FROM message_attachment ma
        WHERE ma.message_id = m.id
          AND ma.moderation_status = 'approved'
          AND ma.mime_type LIKE 'image/%'
        ORDER BY ma.id
        LIMIT 1
    ), '')::text AS first_image_url
FROM message m
WHERE m.id = ANY(sqlc.arg(ids)::bigint[]);

-- name: GetMessageForMutation :one
-- Сообщение с данными, нужными для проверки прав на правку и удаление:
-- автор, время создания, наличие вложений и позиция курсора прочтения у
-- собеседника. Всё одним запросом, чтобы не гонять три round trip перед
-- отказом.
SELECT
    m.id,
    m.conversation_id,
    m.sender_id,
    m.kind,
    m.body,
    m.created_at,
    m.edited_at,
    m.deleted_at,
    (SELECT COUNT(*) FROM message_attachment ma WHERE ma.message_id = m.id) AS attachment_count,
    COALESCE((
        SELECT MAX(cp.last_read_message_id)
        FROM conversation_participant cp
        WHERE cp.conversation_id = m.conversation_id
          AND cp.user_id <> sqlc.arg(user_id)::int
    ), 0)::bigint AS other_last_read_message_id
FROM message m
WHERE m.id = sqlc.arg(message_id);

-- name: UpdateMessageBody :one
-- Правка тела. Условия в WHERE, а не только в Go: параллельный запрос не должен
-- проскочить между проверкой и записью. Пустой результат = правка не разрешена.
UPDATE message
SET body = sqlc.arg(body), edited_at = now()
WHERE id = sqlc.arg(message_id)
  AND sender_id = sqlc.arg(user_id)::int
  AND kind = 'user'
  AND deleted_at IS NULL
  AND created_at > now() - sqlc.arg(edit_window)::interval
RETURNING id, conversation_id, sender_id, body, reply_to_message_id, edited_at, deleted_at, created_at;

-- name: SoftDeleteMessage :one
-- Мягкое удаление: строка остаётся (иначе порвутся цитаты в ответах и
-- разъедется last_read_message_id), но тело обнуляется, чтобы удалённый текст
-- не оставался в базе.
UPDATE message
SET deleted_at = now(), body = NULL
WHERE id = sqlc.arg(message_id)
  AND sender_id = sqlc.arg(user_id)::int
  AND kind = 'user'
  AND deleted_at IS NULL
  AND created_at > now() - sqlc.arg(delete_window)::interval
RETURNING id, conversation_id, sender_id, body, reply_to_message_id, edited_at, deleted_at, created_at;

-- name: LockMessageAttachmentUploads :many
-- Lock registered uploads in a stable order before removing references.
SELECT cu.object_key
FROM chat_upload cu
JOIN (
  SELECT DISTINCT upload_key
  FROM message_attachment
  WHERE message_id = sqlc.arg(message_id)
    AND upload_key IS NOT NULL
) refs ON refs.upload_key = cu.object_key
ORDER BY cu.object_key
FOR UPDATE OF cu;

-- name: LockAttachmentUpload :one
SELECT cu.object_key
FROM chat_upload cu
JOIN message_attachment ma ON ma.upload_key = cu.object_key
WHERE ma.id = sqlc.arg(attachment_id)
FOR UPDATE OF cu;

-- name: DeleteMessageAttachments :exec
-- Legacy rows and registered references are removed together. The caller gets
-- deletable S3 keys from DeleteOrphanedChatUploads, never from this statement.
DELETE FROM message_attachment
WHERE message_id = sqlc.arg(message_id);

-- name: DeleteOrphanedChatUploads :many
DELETE FROM chat_upload cu
WHERE cu.object_key = ANY(sqlc.arg(object_keys)::text[])
  AND NOT EXISTS (
    SELECT 1
    FROM message_attachment ma
    WHERE ma.upload_key = cu.object_key
  )
RETURNING cu.object_key, cu.sealed_key;

-- name: GetUserMediaStanding :one
-- Данные аккаунта для гейта на видео: подтверждён ли телефон и когда создан.
-- created_at в таблице user хранится без таймзоны — приводим к timestamptz,
-- иначе сравнение возраста аккаунта зависит от таймзоны сессии.
SELECT phone_verified_at, created_at::timestamptz AS created_at
FROM "user"
WHERE id = $1;

-- name: GetMessageByID :one
-- Одно сообщение целиком. Нужно воркеру модерации: после вердикта он публикует
-- сообщение, которое при отправке было скрыто от получателя.
SELECT id, conversation_id, sender_id, kind, payload, body,
       reply_to_message_id, edited_at, deleted_at, created_at
FROM message
WHERE id = $1;

-- name: EnqueueAttachmentModeration :exec
-- Ставит вложение в очередь проверки. Повторная постановка того же вложения —
-- не ошибка (UNIQUE по attachment_id), а no-op: сообщение могли переотправить.
INSERT INTO attachment_moderation_job (
  attachment_id, message_id, conversation_id, object_key, mime_type, kind
)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (attachment_id) DO NOTHING;

-- name: ReleaseStaleAttachmentJobs :exec
-- Возвращает в очередь задачи, которые воркер взял и не завершил: процесс мог
-- умереть посреди нарезки кадров. Без этого задача залипает в processing
-- навсегда, а вложение — в pending, то есть получатель его никогда не увидит.
UPDATE attachment_moderation_job
SET status = 'queued',
    last_error = 'processing lease expired',
    updated_at = now()
WHERE status = 'processing'
  AND updated_at < now() - sqlc.arg(lease)::interval;

-- name: ClaimAttachmentModerationJobs :many
-- Отбор пачки задач. FOR UPDATE SKIP LOCKED — чтобы несколько воркеров могли
-- работать параллельно, не разбирая одну задачу дважды.
WITH due AS (
  SELECT id FROM attachment_moderation_job
  WHERE status = 'queued' AND next_attempt_at <= now()
  ORDER BY id
  FOR UPDATE SKIP LOCKED
  LIMIT sqlc.arg(batch_size)
)
UPDATE attachment_moderation_job j
SET status = 'processing', attempts = attempts + 1, updated_at = now()
FROM due
WHERE j.id = due.id
RETURNING j.id, j.attachment_id, j.message_id, j.conversation_id,
          j.object_key, j.mime_type, j.kind, j.attempts;

-- name: CompleteAttachmentModeration :exec
UPDATE attachment_moderation_job
SET status = 'done',
    decision = sqlc.arg(decision),
    category = sqlc.arg(category),
    reason = sqlc.arg(reason),
    confidence = sqlc.arg(confidence),
    frames_checked = sqlc.arg(frames_checked),
    last_error = NULL,
    updated_at = now()
WHERE id = sqlc.arg(job_id);

-- name: FailAttachmentModerationJob :exec
UPDATE attachment_moderation_job
SET status = 'done',
    decision = 'failed',
    category = 'moderation_unavailable',
    reason = LEFT(sqlc.arg(reason), 500),
    confidence = NULL,
    frames_checked = NULL,
    last_error = LEFT(sqlc.arg(last_error), 1000),
    updated_at = now()
WHERE id = sqlc.arg(job_id);

-- name: FailAttachment :exec
UPDATE message_attachment
SET moderation_status = 'failed',
    moderation_reason = LEFT(sqlc.arg(moderation_reason), 500)
WHERE id = sqlc.arg(attachment_id);

-- name: LockFailedAttachmentForRetry :one
SELECT ma.message_id, m.conversation_id
FROM message_attachment ma
JOIN message m ON m.id = ma.message_id
JOIN attachment_moderation_job job ON job.attachment_id = ma.id
WHERE ma.id = sqlc.arg(attachment_id)
  AND m.sender_id = sqlc.arg(sender_id)
  AND ma.moderation_status = 'failed'
  AND job.status = 'done'
FOR UPDATE OF ma, job;

-- name: ResetFailedAttachmentForRetry :execrows
UPDATE message_attachment
SET moderation_status = 'pending',
    moderation_reason = NULL
WHERE id = sqlc.arg(attachment_id)
  AND moderation_status = 'failed';

-- name: RequeueFailedAttachmentModeration :execrows
UPDATE attachment_moderation_job
SET status = 'queued',
    next_attempt_at = now(),
    decision = NULL,
    category = NULL,
    reason = NULL,
    confidence = NULL,
    frames_checked = NULL,
    last_error = NULL,
    updated_at = now()
WHERE attachment_id = sqlc.arg(attachment_id)
  AND status = 'done';

-- name: RetryAttachmentModeration :exec
-- Инфраструктурный сбой (модель недоступна, ffmpeg упал): задача возвращается в
-- очередь с отложенной попыткой. Вложение остаётся pending, то есть не
-- публикуется — при недоступной проверке безопаснее задержать, чем пропустить.
UPDATE attachment_moderation_job
SET status = 'queued',
    next_attempt_at = sqlc.arg(next_attempt_at),
    last_error = sqlc.arg(last_error),
    updated_at = now()
WHERE id = sqlc.arg(job_id);

-- name: SetAttachmentModerationStatus :exec
UPDATE message_attachment
SET moderation_status = sqlc.arg(moderation_status)
WHERE id = sqlc.arg(attachment_id);

-- name: SetAttachmentVideoMeta :exec
-- Длительность и обложка становятся известны только после probe на сервере:
-- заявленным клиентом значениям доверять нельзя.
UPDATE message_attachment
SET duration_seconds = sqlc.arg(duration_seconds),
    thumbnail_url = sqlc.arg(thumbnail_url)
WHERE id = sqlc.arg(attachment_id);

-- name: RejectAttachment :exec
-- Keep a sender-only tombstone with the reason, but detach every reference to
-- the unsafe object before it is removed from storage.
UPDATE message_attachment
SET moderation_status = 'rejected',
    moderation_reason = LEFT(sqlc.arg(moderation_reason), 500),
    url = '',
    thumbnail_url = NULL,
    upload_key = NULL
WHERE id = sqlc.arg(attachment_id);

-- name: CountPendingAttachments :one
-- Сколько вложений сообщения ещё проверяется или ждёт ручного повтора.
-- Ноль означает, что сообщение можно доставлять получателю.
SELECT COUNT(*)::bigint FROM message_attachment
WHERE message_id = $1 AND moderation_status IN ('pending', 'failed');

-- name: GetSuggestionContext :one
-- Контекст беседы для ИИ-подсказок: объявление, роль запрашивающего и курсор
-- последнего сообщения. Один запрос вместо трёх — подсказки запрашиваются при
-- каждом открытии чата, и лишние round trip тут заметны.
SELECT
    c.house_id,
    COALESCE(h.owner_id, 0)::int AS owner_id,
    COALESCE(h.city, '')::text AS city,
    COALESCE(h.street, '')::text AS street,
    COALESCE(h.count_room, '')::text AS count_room,
    COALESCE(h.price, 0)::int AS price,
    COALESCE(h.max_guests, 0)::int AS max_guests,
    to_char(h.check_in_after, 'HH24:MI') AS check_in_after,
    to_char(h.check_out_before, 'HH24:MI') AS check_out_before,
    COALESCE((SELECT MAX(m.id) FROM message m WHERE m.conversation_id = c.id), 0)::bigint AS last_message_id
FROM conversation c
LEFT JOIN house h ON h.id = c.house_id
WHERE c.id = $1;

-- name: GetRecentMessagesForSuggestions :many
-- Последние сообщения беседы для промпта. Удалённые пропускаем: их текста уже
-- нет, а подсказка по пустому сообщению смысла не имеет.
SELECT sender_id, kind, COALESCE(body, '')::text AS body
FROM message
WHERE conversation_id = $1
  AND deleted_at IS NULL
ORDER BY id DESC
LIMIT $2;

-- name: GetMessageConversation :one
-- Беседа процитированного сообщения — для проверки, что реплай не ссылается на
-- чужой диалог.
SELECT conversation_id FROM message WHERE id = $1;

-- name: UpdateLastReadMessage :exec
UPDATE conversation_participant
SET last_read_message_id = $1, last_read_at = now()
WHERE conversation_id = $2 AND user_id = $3;

-- name: CheckParticipantExists :one
SELECT EXISTS(
    SELECT 1 FROM conversation_participant 
    WHERE conversation_id = $1 AND user_id = $2
)::boolean;

-- name: IsOtherParticipantDeleted :one
SELECT COALESCE(u.deleted, false)::boolean
FROM conversation_participant cp
JOIN "user" u ON cp.user_id = u.id
WHERE cp.conversation_id = $1 AND cp.user_id <> $2
LIMIT 1;

-- name: GetOtherParticipantID :one
SELECT user_id::int FROM conversation_participant
WHERE conversation_id = $1 AND user_id <> $2
LIMIT 1;
