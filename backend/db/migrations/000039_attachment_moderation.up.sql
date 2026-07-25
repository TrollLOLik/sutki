-- Асинхронная пост-модерация вложений чата.
--
-- Зачем: до сих пор вложения проверялись синхронно внутри отправки сообщения.
-- Для фото это терпимо, для видео — нет: нарезка кадров плюс vision-запрос на
-- каждый кадр занимают десятки секунд, и держать HTTP-запрос всё это время
-- нельзя. Схема повторяет уже работающую очередь review_moderation_job
-- (миграция 000026): тот же набор колонок статуса, те же попытки с backoff.

-- Статус проверки конкретного вложения.
--   pending  — загружено, ждёт проверки. Отправителю видно «Проверяется»,
--              получателю сообщение не доставляется.
--   approved — проверку прошло, видно обоим.
--   rejected — забраковано, объект удалён из хранилища.
-- Дефолт approved, а не pending: существующие вложения уже прошли синхронную
-- проверку при отправке, и переводить их в pending означало бы спрятать всю
-- историю переписки.
ALTER TABLE message_attachment
  ADD COLUMN IF NOT EXISTS moderation_status varchar(16) NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  -- Длительность видео в секундах. NULL для изображений и документов.
  ADD COLUMN IF NOT EXISTS duration_seconds int,
  -- Ключ обложки в хранилище: в ленте показывается статичная картинка с
  -- кнопкой Play, а плеер открывается только по тапу. Рендерить видео прямо в
  -- списке сообщений нельзя — несколько плееров на экране убивают скролл.
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Частичный индекс: непроверенных вложений всегда меньшинство, а выбирать их
-- нужно на каждой отдаче истории.
CREATE INDEX IF NOT EXISTS idx_message_attachment_pending
  ON message_attachment (message_id)
  WHERE moderation_status = 'pending';

-- Очередь проверки вложений.
--
-- Одна задача = одно вложение, а не сообщение: у альбома из десяти фото каждая
-- проверка независима, и падение одной не должна ретраить остальные девять.
CREATE TABLE IF NOT EXISTS attachment_moderation_job (
  id bigserial PRIMARY KEY,
  attachment_id bigint NOT NULL REFERENCES message_attachment (id) ON DELETE CASCADE,
  -- Дублируем message_id, чтобы решить «все ли вложения сообщения проверены»
  -- без join, и conversation_id — чтобы разослать событие о доставке.
  message_id bigint NOT NULL REFERENCES message (id) ON DELETE CASCADE,
  conversation_id bigint NOT NULL REFERENCES conversation (id) ON DELETE CASCADE,
  -- Ключ объекта в хранилище. Хранится в задаче, потому что при отказе строка
  -- вложения удаляется, а объект из хранилища ещё нужно убрать.
  object_key text NOT NULL,
  mime_type varchar(100) NOT NULL,
  -- 'image' | 'video' | 'animated' — определяет способ проверки: изображение
  -- уходит в модель как есть, видео и анимация сначала режутся на кадры.
  kind varchar(16) NOT NULL CHECK (kind IN ('image', 'video', 'animated')),
  status varchar(16) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'done')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  decision varchar(32),
  category varchar(64),
  reason varchar(500),
  confidence real,
  -- Сколько кадров реально проверили: полезно при разборе жалоб на пропуск.
  frames_checked int,
  last_error varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Повторная постановка того же вложения — не ошибка, а no-op.
  UNIQUE (attachment_id)
);

CREATE INDEX IF NOT EXISTS attachment_moderation_job_due_idx
  ON attachment_moderation_job (status, next_attempt_at, id);
