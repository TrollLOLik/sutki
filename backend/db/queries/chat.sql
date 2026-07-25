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

-- name: CreateMessage :one
INSERT INTO message (conversation_id, sender_id, body, reply_to_message_id, created_at)
VALUES ($1, $2, $3, $4, now())
RETURNING id, conversation_id, sender_id, body, reply_to_message_id, created_at;

-- name: CreateAttachment :one
INSERT INTO message_attachment (message_id, url, file_name, mime_type, size_bytes, width, height)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, message_id, url, file_name, mime_type, size_bytes, width, height;

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
    (SELECT COUNT(*) FROM message m WHERE m.conversation_id = c.id AND m.id > cp.last_read_message_id) AS unread_count,
    m.id AS last_message_id,
    CASE
        WHEN m.deleted_at IS NOT NULL THEN 'Сообщение удалено'
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
    SELECT MAX(id) FROM message WHERE conversation_id = c.id
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
SELECT id, message_id, url, file_name, mime_type, size_bytes, width, height
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
    (SELECT COUNT(*) FROM message_attachment ma WHERE ma.message_id = m.id) AS attachment_count,
    (
        SELECT ma.url
        FROM message_attachment ma
        WHERE ma.message_id = m.id AND ma.mime_type LIKE 'image/%'
        ORDER BY ma.id
        LIMIT 1
    )::text AS first_image_url
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

-- name: DeleteMessageAttachments :many
-- Удаляет вложения удалённого сообщения и возвращает их ключи, чтобы usecase
-- убрал объекты из S3.
DELETE FROM message_attachment
WHERE message_id = sqlc.arg(message_id)
RETURNING url;

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
