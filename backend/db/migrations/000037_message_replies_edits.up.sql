-- Ответы на сообщения (реплаи), редактирование и удаление.
--
-- reply_to_message_id: ON DELETE SET NULL, а не CASCADE. Удаление
-- процитированного сообщения не должно уносить с собой ответы на него — в
-- переписке по сделке это потеря контекста. Клиент показывает такую цитату как
-- «Сообщение удалено».
--
-- Ответ на сообщение из другой беседы БД не запрещает: constraint потребовал бы
-- денормализации conversation_id в message либо триггера. Проверка живёт в
-- usecase-слое (SendMessage), где conversation_id уже под рукой.
ALTER TABLE message
  ADD COLUMN IF NOT EXISTS reply_to_message_id bigint
    REFERENCES message (id) ON DELETE SET NULL,
  -- Время последней правки. NULL — сообщение не редактировалось; клиент
  -- показывает метку «(ред.)» именно по наличию этого значения.
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  -- Мягкое удаление. Строка остаётся: иначе порвутся цитаты в ответах и
  -- разъедется last_read_message_id у участников. Тело обнуляется отдельным
  -- UPDATE, чтобы удалённый текст не оставался в базе.
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Выборка ответов на конкретное сообщение и гидрация цитат постранично.
-- Частичный индекс: реплаев заметно меньше, чем сообщений всего.
CREATE INDEX IF NOT EXISTS idx_message_reply_to
  ON message (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;
