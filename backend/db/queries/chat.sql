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
INSERT INTO message (conversation_id, sender_id, body, created_at)
VALUES ($1, $2, $3, now())
RETURNING id, conversation_id, sender_id, body, created_at;

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
    COALESCE(m.body, (
        SELECT CASE 
            WHEN mime_type LIKE 'image/%' THEN '[Изображение]'
            ELSE '[Документ]: ' || file_name 
        END 
        FROM message_attachment 
        WHERE message_id = m.id 
        LIMIT 1
    ), '')::text AS last_message_body,
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
SELECT id, conversation_id, sender_id, body, created_at
FROM message
WHERE conversation_id = $1
  AND ($2::bigint = 0 OR id < $2)
ORDER BY id DESC
LIMIT $3;

-- name: GetMessageAttachments :many
SELECT id, message_id, url, file_name, mime_type, size_bytes, width, height
FROM message_attachment
WHERE message_id = ANY($1::bigint[]);

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
