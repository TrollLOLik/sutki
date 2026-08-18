(() => {
  'use strict';

  const API_ROOT = '/api/admin/v1';
  const PAGE_LIMIT = 100;
  const AUDIT_LIMIT = 50;
  const VALID_KINDS = new Set(['report', 'listing', 'review', 'review_reply', 'attachment']);
  const SEARCH_KINDS = new Set(['user', 'listing', 'review', 'message']);
  const FILTER_KINDS = {
    all: [''],
    reports: ['report'],
    listings: ['listing'],
    reviews: ['review', 'review_reply'],
    attachments: ['attachment'],
  };
  const KIND_LABELS = {
    report: 'Жалоба',
    user: 'Пользователь',
    listing: 'Объявление',
    message: 'Сообщение',
    review: 'Отзыв',
    review_reply: 'Ответ на отзыв',
    attachment: 'Вложение',
  };
  const ROLE_LABELS = {
    support: 'Поддержка',
    moderator: 'Модератор',
    owner: 'Владелец',
  };
  const REPORT_TARGET_LABELS = {
    user: 'пользователь',
    listing: 'объявление',
    message: 'сообщение',
    review: 'отзыв',
  };
  const REPORT_REASON_LABELS = {
    spam: 'Спам',
    fraud: 'Мошенничество',
    harassment: 'Оскорбления или преследование',
    inappropriate_content: 'Недопустимый контент',
    personal_data: 'Персональные данные',
    other: 'Другое',
  };
  const SANCTIONS = {
    reject_listing: {
      label: 'Снять объявление',
      description: 'Объявление получит статус «Отклонено» и указанную ниже причину.',
    },
    hide_review: {
      label: 'Скрыть отзыв',
      description: 'Отзыв исчезнет из публикации, рейтинг объявления будет пересчитан.',
    },
    hide_message: {
      label: 'Скрыть сообщение',
      description: 'Текст и вложения перестанут отображаться участникам диалога.',
    },
    disable_user: {
      label: 'Отключить аккаунт',
      description: 'Публичный профиль будет скрыт, все пользовательские сессии завершатся.',
    },
  };
  const STATUS_LABELS = {
    new: 'Новая',
    in_review: 'На рассмотрении',
    moderation_review: 'Ручная проверка',
    pending: 'Ожидает повтора',
    resolved: 'Решена',
    dismissed: 'Отклонена',
    active: 'Одобрено',
    approved: 'Одобрено',
    rejected: 'Отклонено',
    failed: 'Ошибка проверки',
    disabled: 'Отключён',
    deleted: 'Удалён',
    hidden: 'Скрыто',
  };
  const FIELD_LABELS = {
    listing_id: 'Объявление', owner_id: 'Владелец', owner_name: 'Имя владельца', owner_email: 'Почта владельца',
    city: 'Город', street: 'Улица', house_number: 'Дом', description: 'Описание', price: 'Цена', rooms: 'Комнаты',
    area: 'Площадь', max_guests: 'Гостей', categories: 'Категории', services: 'Удобства', photos: 'Фотографии',
    reporter_user_id: 'Автор жалобы', reported_user_id: 'Пользователь', target_type: 'Тип цели', target_id: 'ID цели',
    details: 'Комментарий', source: 'Источник', app_version: 'Версия приложения', ip_address: 'IP-адрес', user_agent: 'User-Agent',
    review_id: 'Отзыв', reply_id: 'Ответ', house_id: 'Объявление', author_id: 'Автор', author_name: 'Имя автора',
    rating: 'Оценка', body: 'Текст', review_body: 'Исходный отзыв', listing_address: 'Адрес',
    attachment_id: 'Вложение', message_id: 'Сообщение', conversation_id: 'Диалог', sender_id: 'Отправитель',
    message_body: 'Подпись', file_name: 'Имя файла', mime_type: 'MIME-тип', size_bytes: 'Размер, байт',
    width: 'Ширина', height: 'Высота', url: 'Файл', thumbnail_url: 'Превью',
  };
  const ACTIONS = {
    start_review: { label: 'Взять в работу', title: 'Взять жалобу в работу?', description: 'Статус изменится для остальных операторов.', tone: 'primary', required: false },
    resolve: { label: 'Подтвердить нарушение', title: 'Завершить рассмотрение?', description: 'Жалоба будет отмечена как подтверждённая. Зафиксируйте основание.', tone: 'success', required: true },
    dismiss: { label: 'Отклонить жалобу', title: 'Отклонить жалобу?', description: 'Жалоба уйдёт из активной очереди. Зафиксируйте основание.', tone: 'danger', required: true },
    revoke_sanctions: { label: 'Отменить санкции', title: 'Отменить выбранные санкции?', description: 'Будет восстановлено состояние объектов, сохранённое до применения санкций. Отозванные пользовательские сессии восстановить нельзя.', tone: 'warning', required: true },
    approve: { label: 'Одобрить', title: 'Одобрить материал?', description: 'Материал станет доступен согласно текущим правилам публикации.', tone: 'success', required: false },
    reject: { label: 'Отклонить', title: 'Отклонить материал?', description: 'Пользователь увидит указанную причину решения.', tone: 'danger', required: true },
    retry: { label: 'Повторить проверку', title: 'Перезапустить проверку?', description: 'Вложение вернётся в очередь автоматической модерации.', tone: 'warning', required: false },
  };
  const AUDIT_ACTION_LABELS = {
    'admin.login': 'Вход в панель',
    'admin.logout': 'Выход из панели',
    'admin.staff.create': 'Добавлен сотрудник',
    'admin.staff.update': 'Изменён доступ сотрудника',
  };

  class ApiError extends Error {
    constructor(status, message) {
      super(message || 'Не удалось выполнить запрос.');
      this.name = 'ApiError';
      this.status = status;
    }
  }

  const state = {
    admin: null,
    csrfToken: '',
    filter: 'all',
    items: [],
    total: 0,
    selected: null,
    detail: null,
    pendingAction: null,
    email: '',
    listRequest: 0,
    detailRequest: 0,
    view: 'queue',
    auditItems: [],
    auditTotal: 0,
    auditOffset: 0,
    auditRequest: 0,
    staff: [],
    searchItems: [],
    searchSelected: null,
    searchDetail: null,
    searchRequest: 0,
    searchDetailRequest: 0,
  };

  const $ = (id) => document.getElementById(id);
  const views = { gate: $('session-gate'), auth: $('auth-view'), app: $('app-view') };

  function setVisible(element, visible) {
    element.hidden = !visible;
  }

  function create(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#icon-${name}`);
    svg.append(use);
    return svg;
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    if (options.csrf) headers.set('X-CSRF-Token', state.csrfToken);

    let response;
    try {
      response = await fetch(`${API_ROOT}${path}`, {
        method: options.method || 'GET',
        headers,
        credentials: 'include',
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (_error) {
      throw new ApiError(0, 'Нет соединения с сервером. Проверьте сеть и попробуйте снова.');
    }

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};
    if (!response.ok) {
      throw new ApiError(response.status, payload.error || `Сервер вернул ошибку ${response.status}.`);
    }
    return response.status === 204 ? null : payload;
  }

  function setButtonLoading(button, loading) {
    button.disabled = loading;
    button.classList.toggle('is-loading', loading);
    button.setAttribute('aria-busy', String(loading));
  }

  function showAuth(message = '') {
    state.admin = null;
    state.csrfToken = '';
    state.selected = null;
    state.detail = null;
    state.view = 'queue';
    setVisible(views.gate, false);
    setVisible(views.app, false);
    setVisible(views.auth, true);
    showAuthStep('email');
    setAuthMessage(message, Boolean(message));
  }

  function showApp() {
    setVisible(views.gate, false);
    setVisible(views.auth, false);
    setVisible(views.app, true);
    $('operator-role').textContent = ROLE_LABELS[state.admin.role] || state.admin.role;
    $('operator-email').textContent = state.admin.email;

    const isOwner = state.admin.role === 'owner';
    document.querySelectorAll('.owner-only').forEach((element) => setVisible(element, isOwner));
    if (!isOwner && !['queue', 'search'].includes(state.view)) state.view = 'queue';
    updateAppView();

    const supportOnly = state.admin.role === 'support';
    document.querySelectorAll('.filter-tab').forEach((tab) => {
      const hidden = supportOnly && !['all', 'reports'].includes(tab.dataset.filter);
      tab.hidden = hidden;
    });
    if (supportOnly && !['all', 'reports'].includes(state.filter)) state.filter = 'all';
    document.querySelectorAll('.moderation-search-option').forEach((option) => { option.hidden = supportOnly; });
    if (supportOnly && $('search-kind').value !== 'user') $('search-kind').value = 'user';
    updateSearchInput();
    updateFilterTabs();
  }

  function showAuthStep(step) {
    const emailStep = step === 'email';
    setVisible($('email-form'), emailStep);
    setVisible($('code-form'), !emailStep);
    $('auth-step-label').textContent = emailStep ? 'Шаг 1 из 2' : 'Шаг 2 из 2';
    $('auth-title').textContent = emailStep ? 'Вход в панель' : 'Введите код';
    $('auth-description').textContent = emailStep ? 'Укажите служебную почту.' : 'Код действует ограниченное время.';
    if (!emailStep) {
      $('code-email').textContent = state.email;
      requestAnimationFrame(() => $('code').focus());
    }
  }

  function setAuthMessage(message, error = false) {
    const element = $('auth-message');
    element.textContent = message;
    element.classList.toggle('is-error', error);
    setVisible(element, Boolean(message));
  }

  function setFieldError(input, errorElement, message) {
    input.setAttribute('aria-invalid', String(Boolean(message)));
    errorElement.textContent = message || '';
    setVisible(errorElement, Boolean(message));
  }

  function emailValid(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  async function requestCode() {
    const email = $('email').value.trim().toLowerCase();
    if (!emailValid(email)) {
      setFieldError($('email'), $('email-error'), 'Введите корректный адрес электронной почты.');
      return;
    }
    setFieldError($('email'), $('email-error'), '');
    const button = $('request-code-button');
    setButtonLoading(button, true);
    try {
      const result = await api('/auth/request-code', { method: 'POST', body: { email } });
      state.email = email;
      setAuthMessage(result.message || 'Если адресу разрешён доступ, код отправлен.');
      showAuthStep('code');
    } catch (error) {
      setAuthMessage(error.message, true);
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function verifyCode() {
    const code = $('code').value.replace(/\D/g, '').slice(0, 6);
    $('code').value = code;
    if (code.length !== 6) {
      setFieldError($('code'), $('code-error'), 'Введите шестизначный код.');
      return;
    }
    setFieldError($('code'), $('code-error'), '');
    const button = $('verify-code-button');
    setButtonLoading(button, true);
    try {
      const result = await api('/auth/verify-code', { method: 'POST', body: { email: state.email, code } });
      state.admin = result.admin;
      state.csrfToken = result.csrf_token;
      $('code').value = '';
      showApp();
      await refreshActiveView(true);
    } catch (error) {
      setFieldError($('code'), $('code-error'), error.message);
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function boot() {
    try {
      const result = await api('/auth/me');
      state.admin = result.admin;
      state.csrfToken = result.csrf_token || '';
      if (!state.csrfToken) throw new ApiError(401, 'Защитный токен сессии недоступен. Войдите снова.');
      showApp();
      await refreshActiveView(true);
    } catch (error) {
      if (error.status && error.status !== 401) {
        showAuth('Панель временно недоступна. Попробуйте войти ещё раз.');
      } else {
        showAuth();
      }
    }
  }

  async function logout() {
    const button = $('logout-button');
    button.disabled = true;
    try {
      await api('/auth/logout', { method: 'POST', csrf: true });
    } catch (error) {
      if (error.status !== 401) toast(error.message, 'error');
    } finally {
      button.disabled = false;
      showAuth();
    }
  }

  function handleSessionError(error) {
    if (error.status === 401 || (error.status === 403 && /токен|сесси/i.test(error.message))) {
      showAuth('Сессия истекла. Войдите снова.');
      return true;
    }
    return false;
  }

  async function loadSummary() {
    const summary = await api('/inbox/summary');
    Object.entries(summary).forEach(([name, value]) => {
      const element = document.querySelector(`[data-count="${name}"]`);
      if (element) element.textContent = String(value);
    });
    $('queue-total').textContent = String(summary.total || 0);
  }

  async function loadPage(kind) {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT), offset: '0' });
    if (kind) params.set('kind', kind);
    return api(`/inbox?${params.toString()}`);
  }

  async function loadList() {
    const requestID = ++state.listRequest;
    setVisible($('queue-loading'), true);
    setVisible($('queue-error'), false);
    setVisible($('queue-empty'), false);
    $('queue-list').replaceChildren();
    const kinds = FILTER_KINDS[state.filter] || [''];
    try {
      const pages = await Promise.all(kinds.map(loadPage));
      if (requestID !== state.listRequest) return;
      const byKey = new Map();
      pages.flatMap((page) => page.items || []).forEach((item) => byKey.set(`${item.kind}:${item.id}`, item));
      state.items = Array.from(byKey.values()).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      state.total = pages.reduce((sum, page) => sum + Number(page.total || 0), 0);
      renderList();
      setVisible($('queue-empty'), state.items.length === 0);
      setVisible($('queue-cap'), state.total > state.items.length);
    } catch (error) {
      if (requestID !== state.listRequest || handleSessionError(error)) return;
      $('queue-error-text').textContent = error.message;
      setVisible($('queue-error'), true);
    } finally {
      if (requestID === state.listRequest) setVisible($('queue-loading'), false);
    }
  }

  function renderList() {
    const fragment = document.createDocumentFragment();
    state.items.forEach((item) => {
      const button = create('button', 'queue-item');
      button.type = 'button';
      button.setAttribute('role', 'listitem');
      button.dataset.kind = item.kind;
      button.dataset.id = String(item.id);
      button.classList.toggle('is-selected', selectedMatches(item.kind, item.id));

      const top = create('div', 'queue-item-top');
      top.append(create('span', 'queue-item-kind', KIND_LABELS[item.kind] || item.kind));
      top.append(create('time', 'queue-item-time', relativeDate(item.updated_at)));
      button.append(top, create('h2', 'queue-item-title', item.title), create('p', 'queue-item-summary', item.summary || item.reason || 'Без дополнительного описания'));

      const bottom = create('div', 'queue-item-bottom');
      const meta = create('span', 'queue-item-meta');
      meta.append(icon('clock'), document.createTextNode(formatDateTime(item.created_at)));
      const status = create('span', 'queue-status', statusLabel(item.status));
      status.dataset.tone = statusTone(item.status);
      bottom.append(meta, status);
      button.append(bottom);
      button.addEventListener('click', () => openDetail(item.kind, item.id));
      fragment.append(button);
    });
    $('queue-list').replaceChildren(fragment);
  }

  function selectedMatches(kind, id) {
    return state.selected && state.selected.kind === kind && Number(state.selected.id) === Number(id);
  }

  function updateSelectedRow() {
    document.querySelectorAll('.queue-item').forEach((row) => {
      row.classList.toggle('is-selected', selectedMatches(row.dataset.kind, row.dataset.id));
    });
  }

  async function openDetail(kind, id) {
    const requestID = ++state.detailRequest;
    state.selected = { kind, id: Number(id) };
    updateSelectedRow();
    $('detail-pane').classList.add('is-open');
    setVisible($('detail-blank'), false);
    setVisible($('detail-content'), false);
    setVisible($('detail-error'), false);
    setVisible($('detail-loading'), true);
    try {
      const detail = await api(`/inbox/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`);
      if (requestID !== state.detailRequest) return;
      state.detail = detail;
      renderDetail(detail);
    } catch (error) {
      if (requestID !== state.detailRequest || handleSessionError(error)) return;
      $('detail-error-text').textContent = error.message;
      setVisible($('detail-error'), true);
    } finally {
      if (requestID === state.detailRequest) setVisible($('detail-loading'), false);
    }
  }

  function closeDetail() {
    state.selected = null;
    state.detail = null;
    ++state.detailRequest;
    $('detail-pane').classList.remove('is-open');
    setVisible($('detail-content'), false);
    setVisible($('detail-error'), false);
    setVisible($('detail-loading'), false);
    setVisible($('detail-blank'), true);
    updateSelectedRow();
  }

  function renderDetail(detail) {
    const item = detail.item;
    const media = Array.isArray(detail.media) ? detail.media : [];
    const users = Array.isArray(detail.users) ? detail.users : [];
    const relatedReports = Array.isArray(detail.related_reports) ? detail.related_reports : [];
    $('detail-kind').textContent = KIND_LABELS[item.kind] || item.kind;
    $('detail-status').textContent = statusLabel(item.status);
    $('detail-status').dataset.tone = statusTone(item.status);
    $('detail-title').textContent = item.title;
    $('detail-summary').textContent = item.summary || item.reason || 'Дополнительное описание отсутствует.';
    renderMeta(item);
    renderTimeline(item);
    renderUsers(item, users);
    renderRelatedReports(item, relatedReports);
    renderMedia(item, media);
    renderEvidence(normalizeJSON(detail.evidence), media.length > 0);
    $('diagnostics-json').textContent = JSON.stringify(normalizeJSON(detail.context), null, 2);
    renderActions(item);
    setVisible($('detail-content'), true);
  }

  function userRelationLabel(item, relation) {
    if (relation === 'reporter') return 'Автор жалобы';
    if (item.kind === 'user') return 'Найденный пользователь';
    if (item.kind === 'report') return 'Пользователь, на которого пожаловались';
    if (item.kind === 'listing') return 'Владелец объявления';
    if (item.kind === 'attachment') return 'Отправитель вложения';
    return 'Автор материала';
  }

  function userAccountStatus(user) {
    if (user.deleted) return { label: 'Удалён', tone: 'danger' };
    if (!user.account_enabled) return { label: 'Отключён', tone: 'danger' };
    return { label: 'Активен', tone: 'success' };
  }

  function userField(label, value, tone = '') {
    const row = create('div', 'user-field');
    row.append(create('span', 'user-field-label', label));
    const content = create('strong', tone ? `user-field-value user-field-value-${tone}` : 'user-field-value', value || '—');
    row.append(content);
    return row;
  }

  function userMetric(value, label) {
    const metric = create('div', 'user-metric');
    metric.append(create('strong', '', Number(value || 0).toLocaleString('ru-RU')), create('span', '', label));
    return metric;
  }

  function renderUsers(item, users) {
    const section = $('users-section');
    const grid = $('users-grid');
    if (!Array.isArray(users) || users.length === 0) {
      grid.replaceChildren();
      setVisible(section, false);
      return;
    }

    const cards = users.map((user) => {
      const card = create('article', 'user-card');
      const heading = create('div', 'user-card-heading');
      const identity = create('div', 'user-card-identity');
      const avatar = create('span', 'user-avatar', String(user.name || 'П').trim().slice(0, 1).toUpperCase());
      const title = create('div');
      title.append(
        create('span', 'user-relation', userRelationLabel(item, user.relation)),
        create('h3', '', user.name || `Пользователь #${user.id}`),
        create('small', '', `ID ${user.id}`),
      );
      identity.append(avatar, title);
      const accountStatus = userAccountStatus(user);
      const badge = create('span', 'status-badge', accountStatus.label);
      badge.dataset.tone = accountStatus.tone;
      heading.append(identity, badge);

      const fields = create('div', 'user-fields');
      fields.append(
        userField('Почта', user.email),
        userField('Телефон', user.phone, user.phone_verified ? 'success' : ''),
        userField('Город', user.city),
        userField('Создан', formatDateTime(user.created_at)),
        userField('Последняя активность', user.last_seen_at ? formatDateTime(user.last_seen_at) : 'Нет данных'),
        userField('Версия приложения', user.last_app_version || 'Нет данных'),
      );

      const flags = create('div', 'user-flags');
      const flagValues = [
        [user.phone_verified, 'Номер подтверждён'],
        [user.identity_verified, 'Аккаунт подтверждён'],
        [user.public_profile_visible, 'Профиль публичный'],
      ];
      flagValues.forEach(([active, label]) => {
        const flag = create('span', active ? 'user-flag is-active' : 'user-flag', label);
        flag.prepend(icon(active ? 'check' : 'x'));
        flags.append(flag);
      });

      const metrics = create('div', 'user-metrics');
      metrics.append(
        userMetric(user.listings_active, 'активных объявлений'),
        userMetric(user.listings_total, 'объявлений всего'),
        userMetric(user.reviews_authored, 'оставлено отзывов'),
        userMetric(user.bookings_as_guest, 'исходящих заявок'),
        userMetric(user.bookings_as_owner, 'входящих заявок'),
        userMetric(user.reports_received, 'жалоб получено'),
        userMetric(user.reports_submitted, 'жалоб отправлено'),
        userMetric(user.blocks_received, 'заблокировали'),
        userMetric(user.blocks_created, 'заблокировано им'),
        userMetric(user.active_sessions, 'активных сессий'),
      );
      card.append(heading, fields, flags, metrics);
      return card;
    });
    grid.replaceChildren(...cards);
    setVisible(section, true);
  }

  function renderRelatedReports(item, reports) {
    const section = $('related-reports-section');
    const list = $('related-reports-list');
    if (item.kind !== 'report' || !Array.isArray(reports) || reports.length === 0) {
      list.replaceChildren();
      setVisible(section, false);
      return;
    }

    const createReportCard = (report) => {
      const button = create('button', 'related-report');
      button.type = 'button';
      button.addEventListener('click', () => void openDetail('report', report.id));

      const heading = create('div', 'related-report-heading');
      const identity = create('div', 'related-report-identity');
      identity.append(
        create('strong', '', `Жалоба #${report.id}`),
        create('span', '', `${REPORT_TARGET_LABELS[report.target_type] || report.target_type} #${report.target_id}`),
      );
      const status = create('span', 'status-badge', statusLabel(report.status));
      status.dataset.tone = statusTone(report.status);
      heading.append(identity, status);

      const matches = create('div', 'related-report-matches');
      if (report.same_target) matches.append(create('span', 'relation-chip relation-chip-target', 'Тот же объект'));
      if (report.same_user) matches.append(create('span', 'relation-chip relation-chip-user', 'Тот же пользователь'));

      const body = create(
        'p',
        'related-report-summary',
        report.details || REPORT_REASON_LABELS[report.reason] || report.reason || 'Комментарий отсутствует.',
      );
      const meta = create('span', 'related-report-date', formatDateTime(report.created_at));
      button.append(heading, matches, body, meta);
      return button;
    };

    const groups = [
      {
        title: 'Тот же объект',
        description: 'Повторные жалобы на это же объявление, сообщение, отзыв или профиль.',
        reports: reports.filter((report) => report.same_target),
      },
      {
        title: 'Тот же пользователь',
        description: 'Жалобы на другие материалы этого же пользователя.',
        reports: reports.filter((report) => report.same_user && !report.same_target),
      },
    ].filter((group) => group.reports.length > 0);

    list.replaceChildren(...groups.map((group) => {
      const wrapper = create('section', 'related-report-group');
      const heading = create('div', 'related-report-group-heading');
      const copy = create('div');
      copy.append(create('h3', '', group.title), create('p', '', group.description));
      heading.append(copy, create('span', 'related-report-count', String(group.reports.length)));
      const grid = create('div', 'related-report-grid');
      grid.append(...group.reports.map(createReportCard));
      wrapper.append(heading, grid);
      return wrapper;
    }));
    setVisible(section, true);
  }

  function renderMeta(item) {
    const values = [
      `ID ${item.id}`,
      item.subject_user_id ? `Пользователь #${item.subject_user_id}` : '',
      item.attempts ? `Попыток: ${item.attempts}` : '',
      `Обновлено ${formatDateTime(item.updated_at)}`,
    ].filter(Boolean);
    $('detail-meta').replaceChildren(...values.map((value) => create('span', '', value)));
  }

  function renderTimeline(item) {
    const steps = [
      { label: 'Создано', title: formatDateTime(item.created_at), body: item.summary || '' },
    ];
    if (item.reason) steps.push({ label: 'Основание проверки', title: 'Причина', body: item.reason });
    steps.push({ label: 'Текущее состояние', title: statusLabel(item.status), body: `Последнее изменение: ${formatDateTime(item.updated_at)}` });
    $('decision-timeline').replaceChildren(...steps.map((step) => {
      const row = create('li', 'decision-step');
      row.append(create('span', 'decision-step-label', step.label), create('strong', '', step.title));
      if (step.body) row.append(create('p', '', step.body));
      return row;
    }));
  }

  function normalizeJSON(value) {
    if (!value) return {};
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch (_error) { return { value }; }
    }
    return value;
  }

  function inboxMediaURL(item, mediaID, variant = 'original') {
    const suffix = variant === 'thumbnail' ? '?variant=thumbnail' : '';
    return `${API_ROOT}/inbox/${encodeURIComponent(item.kind)}/${encodeURIComponent(item.id)}/media/${encodeURIComponent(mediaID)}${suffix}`;
  }

  function formatFileSize(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} МБ`;
  }

  function mediaFallback(text) {
    const fallback = create('div', 'media-fallback');
    fallback.append(icon('alert'), create('span', '', text));
    return fallback;
  }

  function renderMedia(item, media) {
    const section = $('media-section');
    const gallery = $('media-gallery');
    if (!Array.isArray(media) || media.length === 0) {
      gallery.replaceChildren();
      setVisible(section, false);
      return;
    }

    const cards = media.map((file) => {
      const card = create('article', 'media-card');
      const mime = String(file.mime_type || 'application/octet-stream').toLowerCase();
      const fileURL = inboxMediaURL(item, file.id);
      const visual = create('div', 'media-visual');

      if (mime.startsWith('image/')) {
        const link = create('a', 'media-open');
        link.href = fileURL;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const image = create('img');
        image.src = fileURL;
        image.alt = file.file_name || `Изображение #${file.id}`;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => link.replaceChildren(mediaFallback('Изображение недоступно')),
          { once: true });
        link.append(image);
        visual.append(link);
      } else if (mime.startsWith('video/')) {
        const video = create('video');
        video.controls = true;
        video.preload = 'metadata';
        video.src = fileURL;
        if (file.has_thumbnail) video.poster = inboxMediaURL(item, file.id, 'thumbnail');
        video.addEventListener('error', () => visual.replaceChildren(mediaFallback('Видео недоступно')),
          { once: true });
        visual.append(video);
      } else {
        const link = create('a', 'media-document');
        link.href = fileURL;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.append(icon('file'), create('span', '', 'Открыть файл'));
        visual.append(link);
      }

      const meta = create('div', 'media-card-meta');
      meta.append(create('strong', '', file.file_name || `Файл #${file.id}`));
      const details = [mime, formatFileSize(file.size_bytes)];
      if (file.width && file.height) details.push(`${file.width} × ${file.height}`);
      meta.append(create('span', '', details.filter(Boolean).join(' · ')));
      card.append(visual, meta);
      return card;
    });
    gallery.replaceChildren(...cards);
    setVisible(section, true);
  }

  function renderEvidence(evidence, hasMedia = false) {
    const container = $('evidence-content');
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) || Object.keys(evidence).length === 0) {
      container.replaceChildren(create('p', 'evidence-empty', 'Снимок данных для этого элемента отсутствует.'));
      return;
    }
    const fragment = document.createDocumentFragment();
    const hiddenMediaKeys = new Set(['photos', 'url', 'thumbnail_url']);
    Object.entries(evidence).filter(([key]) => !hiddenMediaKeys.has(key)).forEach(([key, value]) => {
      const row = create('div', 'evidence-row');
      row.append(create('dt', '', FIELD_LABELS[key] || humanizeKey(key)));
      const data = create('dd');
      appendValue(data, key, value);
      row.append(data);
      fragment.append(row);
    });
    if (fragment.childNodes.length === 0) {
      container.replaceChildren(create(
        'p',
        'evidence-empty',
        hasMedia ? 'Основные материалы показаны в галерее выше.' : 'Медиа удалено или временно недоступно.',
      ));
      return;
    }
    container.replaceChildren(fragment);
  }

  function appendValue(target, key, value) {
    if (value === null || value === undefined || value === '') {
      target.textContent = '—';
      return;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        target.textContent = '—';
        return;
      }
      const list = create('div', 'value-list');
      value.forEach((entry) => list.append(create('span', 'value-chip', typeof entry === 'object' ? compactObject(entry) : entry)));
      target.append(list);
      return;
    }
    if (typeof value === 'object') {
      target.textContent = compactObject(value);
      return;
    }
    const stringValue = String(value);
    if (/url|link/i.test(key) && /^https:\/\//i.test(stringValue)) {
      const link = create('a', 'evidence-link', 'Открыть');
      link.href = stringValue;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      target.append(link);
      return;
    }
    target.textContent = typeof value === 'boolean' ? (value ? 'Да' : 'Нет') : stringValue;
  }

  function compactObject(value) {
    if (value && typeof value === 'object') {
      const parts = Object.entries(value).map(([key, entry]) => `${FIELD_LABELS[key] || humanizeKey(key)}: ${entry ?? '—'}`);
      return parts.join(' · ');
    }
    return String(value);
  }

  function humanizeKey(key) {
    return key.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
  }

  function availableActions(item) {
    if (item.kind === 'report') {
      if (item.status === 'new') return ['start_review', 'resolve', 'dismiss'];
      if (item.status === 'in_review') return ['resolve', 'dismiss'];
      if (item.status === 'resolved' && state.admin.role !== 'support' && (state.detail?.active_sanctions?.length || 0) > 0) {
        return ['revoke_sanctions'];
      }
      return [];
    }
    if (state.admin.role === 'support') return [];
    if (['listing', 'review', 'review_reply'].includes(item.kind)) return ['approve', 'reject'];
    if (item.kind === 'attachment') return ['retry'];
    return [];
  }

  function renderActions(item) {
    const bar = $('action-bar');
    const actions = availableActions(item);
    if (actions.length === 0) {
      bar.replaceChildren(create('span', 'action-bar-note', 'Для этого элемента нет доступных действий.'));
      return;
    }
    const fragment = document.createDocumentFragment();
    fragment.append(create('span', 'action-bar-note', 'Решение будет записано в журнал аудита.'));
    actions.forEach((name) => {
      const config = ACTIONS[name];
      const button = create('button', `button button-${config.tone}`, config.label);
      button.type = 'button';
      button.addEventListener('click', () => openActionModal(name));
      fragment.append(button);
    });
    bar.replaceChildren(fragment);
  }

  function openActionModal(action) {
    const config = ACTIONS[action];
    state.pendingAction = action;
    $('modal-title').textContent = config.title;
    $('modal-description').textContent = config.description;
    $('reason-required').textContent = config.required ? 'обязательно' : 'необязательно';
    $('reason-required').classList.toggle('is-optional', !config.required);
    $('action-reason').required = config.required;
    $('action-reason').value = '';
    $('reason-count').textContent = '0 / 2000';
    $('reason-error').textContent = '';
    $('action-reason').setAttribute('aria-invalid', 'false');
    renderSanctionOptions(action);
    const confirm = $('confirm-action-button');
    confirm.className = `button button-${config.tone}`;
    confirm.querySelector('span').textContent = config.label;
    const modal = $('action-modal');
    setVisible(modal, true);
    requestAnimationFrame(() => {
      modal.classList.add('is-open');
      (config.required ? $('action-reason') : confirm).focus();
    });
  }

  function reportTargetType() {
    if (!state.detail || state.detail.item?.kind !== 'report') return '';
    const context = normalizeJSON(state.detail.context);
    return String(context.target_type || '').trim();
  }

  function availableSanctions() {
    if (!state.detail || state.detail.item?.kind !== 'report' || state.admin?.role === 'support') return [];
    const result = [];
    const targetType = reportTargetType();
    if (targetType === 'listing') result.push('reject_listing');
    if (targetType === 'review') result.push('hide_review');
    if (targetType === 'message') result.push('hide_message');
    if (state.detail.item.subject_user_id) result.push('disable_user');
    return result;
  }

  function renderSanctionOptions(action) {
    const field = $('sanction-field');
    const container = $('sanction-options');
    const isRevoke = action === 'revoke_sanctions';
    const sanctions = action === 'resolve'
      ? availableSanctions().map((type) => ({ type }))
      : isRevoke ? (state.detail?.active_sanctions || []) : [];
    if (sanctions.length === 0) {
      container.replaceChildren();
      field.classList.remove('is-revoke');
      setVisible(field, false);
      return;
    }
    $('sanction-title').textContent = isRevoke ? 'Отменяемые санкции' : 'Санкции';
    $('sanction-note').textContent = isRevoke
      ? 'Выберите последствия, которые нужно отменить. Жалоба останется закрытой, а отмена попадёт в журнал аудита.'
      : 'Выберите только те последствия, которые подтверждены материалами жалобы. Похожие жалобы автоматически не закрываются.';
    field.classList.toggle('is-revoke', isRevoke);
    container.replaceChildren(...sanctions.map((sanction) => {
      const config = SANCTIONS[sanction.type];
      const label = create('label', 'sanction-option');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = isRevoke ? 'sanction_ids' : 'sanctions';
      input.value = isRevoke ? String(sanction.id) : sanction.type;
      const copy = create('span', 'sanction-option-copy');
      const title = isRevoke ? `Отменить: ${config?.label || sanction.type}` : config.label;
      const description = isRevoke ? sanctionDescription(sanction) : config.description;
      copy.append(create('strong', '', title), create('small', '', description));
      label.append(input, create('span', 'sanction-checkbox'), copy);
      return label;
    }));
    setVisible(field, true);
  }

  function sanctionDescription(sanction) {
    const target = `${KIND_LABELS[sanction.target_type] || humanizeKey(sanction.target_type || 'объект')} #${sanction.target_id}`;
    const actor = sanction.applied_by_email || 'сотрудник не указан';
    const appliedAt = sanction.applied_at ? formatDateTime(sanction.applied_at) : 'дата не указана';
    const reason = sanction.reason ? ` Причина: ${sanction.reason}` : '';
    return `${target} · ${actor} · ${appliedAt}.${reason}`;
  }

  function closeActionModal() {
    const modal = $('action-modal');
    if (modal.hidden || modal.classList.contains('is-closing')) return;
    modal.classList.remove('is-open');
    modal.classList.add('is-closing');
    window.setTimeout(() => {
      modal.classList.remove('is-closing');
      setVisible(modal, false);
      state.pendingAction = null;
    }, 170);
  }

  async function submitAction() {
    if (!state.pendingAction || !state.detail) return;
    const config = ACTIONS[state.pendingAction];
    const reason = $('action-reason').value.trim();
    const selectedSanctions = Array.from(document.querySelectorAll('#sanction-options input:checked'));
    const sanctions = state.pendingAction === 'resolve' ? selectedSanctions.map((input) => input.value) : [];
    const sanctionIDs = state.pendingAction === 'revoke_sanctions' ? selectedSanctions.map((input) => Number(input.value)) : [];
    if (config.required && !reason) {
      $('reason-error').textContent = 'Укажите причину решения.';
      $('action-reason').setAttribute('aria-invalid', 'true');
      $('action-reason').focus();
      return;
    }
    if (state.pendingAction === 'revoke_sanctions' && sanctionIDs.length === 0) {
      $('reason-error').textContent = 'Выберите хотя бы одну санкцию для отмены.';
      return;
    }
    const button = $('confirm-action-button');
    setButtonLoading(button, true);
    try {
      await api(`/inbox/${encodeURIComponent(state.selected.kind)}/${state.selected.id}/actions`, {
        method: 'POST', csrf: true, body: { action: state.pendingAction, reason, sanctions, sanction_ids: sanctionIDs },
      });
      closeActionModal();
      toast('Решение сохранено.', 'success');
      closeDetail();
      await refreshWorkspace(false);
    } catch (error) {
      if (handleSessionError(error)) return;
      if (error.status === 409) {
        closeActionModal();
        toast('Состояние уже изменилось другим оператором. Очередь обновлена.', 'warning');
        closeDetail();
        await refreshWorkspace(false);
      } else {
        $('reason-error').textContent = error.message;
      }
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function refreshWorkspace(followDeepLink) {
    $('refresh-button').classList.add('is-spinning');
    try {
      await Promise.all([loadSummary(), loadList()]);
      $('updated-at').textContent = `Обновлено ${new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
      if (followDeepLink) await openDeepLink();
    } catch (error) {
      if (!handleSessionError(error)) toast(error.message, 'error');
    } finally {
      $('refresh-button').classList.remove('is-spinning');
    }
  }

  function updateAppView() {
    setVisible($('queue-workspace'), state.view === 'queue');
    setVisible($('search-view'), state.view === 'search');
    setVisible($('audit-view'), state.view === 'audit');
    setVisible($('staff-view'), state.view === 'staff');
    document.querySelectorAll('.app-nav-button').forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  async function switchView(view) {
    if (!['queue', 'search', 'audit', 'staff'].includes(view)) return;
    if (['audit', 'staff'].includes(view) && state.admin.role !== 'owner') return;
    state.view = view;
    closeDetail();
    updateAppView();
    await refreshActiveView(false);
  }

  async function refreshActiveView(followDeepLink = false) {
    $('refresh-button').classList.add('is-spinning');
    try {
      if (state.view === 'audit') await loadAudit();
      else if (state.view === 'staff') await loadStaff();
      else if (state.view === 'search') {
        if ($('search-query').value.trim()) await runSearch();
      }
      else await refreshWorkspace(followDeepLink);
    } catch (error) {
      if (!handleSessionError(error)) toast(error.message, 'error');
    } finally {
      $('refresh-button').classList.remove('is-spinning');
    }
  }

  function updateSearchInput() {
    const userSearch = $('search-kind').value === 'user';
    $('search-query').placeholder = userSearch ? 'ID, полный телефон или почта' : 'ID объекта';
    $('search-query').inputMode = userSearch ? 'search' : 'numeric';
    $('search-hint').textContent = userSearch
      ? 'Поиск выполняется по точному ID, полному телефону или адресу почты.'
      : 'Укажите полный числовой ID. Поиск по тексту намеренно отключён.';
  }

  async function runSearch() {
    const kind = $('search-kind').value;
    const query = $('search-query').value.trim();
    if (!SEARCH_KINDS.has(kind) || !query) {
      $('search-error').textContent = 'Укажите полный идентификатор для поиска.';
      setVisible($('search-error'), true);
      $('search-query').focus();
      return;
    }
    if (kind !== 'user' && !/^\d+$/.test(query)) {
      $('search-error').textContent = 'Для этого объекта нужен числовой ID.';
      setVisible($('search-error'), true);
      $('search-query').focus();
      return;
    }

    const requestID = ++state.searchRequest;
    state.searchSelected = null;
    state.searchDetail = null;
    setButtonLoading($('search-button'), true);
    setVisible($('search-error'), false);
    setVisible($('search-empty'), false);
    setVisible($('search-loading'), true);
    setVisible($('search-workspace'), false);
    try {
      const result = await api(`/search?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(query)}`);
      if (requestID !== state.searchRequest) return;
      state.searchItems = Array.isArray(result.items) ? result.items : [];
      $('search-total').textContent = String(state.searchItems.length);
      $('search-result-count').textContent = String(state.searchItems.length);
      renderSearchResults();
      setVisible($('search-empty'), state.searchItems.length === 0);
      setVisible($('search-workspace'), state.searchItems.length > 0);
      if (state.searchItems.length === 1) {
        await openSearchDetail(state.searchItems[0].kind, state.searchItems[0].id);
      }
    } catch (error) {
      if (requestID !== state.searchRequest || handleSessionError(error)) return;
      $('search-error').textContent = error.message;
      setVisible($('search-error'), true);
    } finally {
      if (requestID === state.searchRequest) {
        setVisible($('search-loading'), false);
        setButtonLoading($('search-button'), false);
      }
    }
  }

  function renderSearchResults() {
    const rows = state.searchItems.map((item) => {
      const button = create('button', 'search-result');
      button.type = 'button';
      button.dataset.kind = item.kind;
      button.dataset.id = String(item.id);
      const heading = create('div', 'search-result-heading');
      heading.append(create('strong', '', item.title || `${KIND_LABELS[item.kind] || item.kind} #${item.id}`));
      const status = create('span', 'status-badge', statusLabel(item.status));
      status.dataset.tone = statusTone(item.status);
      heading.append(status);
      button.append(
        heading,
        create('span', 'search-result-kind', `${KIND_LABELS[item.kind] || item.kind} · ID ${item.id}`),
        create('p', '', item.summary || 'Дополнительные данные отсутствуют.'),
      );
      button.addEventListener('click', () => void openSearchDetail(item.kind, item.id));
      return button;
    });
    $('search-results-list').replaceChildren(...rows);
  }

  async function openSearchDetail(kind, id) {
    const requestID = ++state.searchDetailRequest;
    state.searchSelected = { kind, id: Number(id) };
    document.querySelectorAll('.search-result').forEach((row) => {
      row.classList.toggle('is-selected', row.dataset.kind === kind && Number(row.dataset.id) === Number(id));
    });
    setVisible($('search-detail-blank'), false);
    setVisible($('search-detail-content'), false);
    setVisible($('search-detail-error'), false);
    setVisible($('search-detail-loading'), true);
    try {
      const detail = await api(`/search/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`);
      if (requestID !== state.searchDetailRequest) return;
      state.searchDetail = detail;
      renderSearchDetail(detail);
    } catch (error) {
      if (requestID !== state.searchDetailRequest || handleSessionError(error)) return;
      $('search-detail-error').textContent = error.message;
      setVisible($('search-detail-error'), true);
    } finally {
      if (requestID === state.searchDetailRequest) setVisible($('search-detail-loading'), false);
    }
  }

  function renderSearchDetail(detail) {
    const item = detail.item;
    $('search-detail-kind').textContent = KIND_LABELS[item.kind] || item.kind;
    $('search-detail-status').textContent = statusLabel(item.status);
    $('search-detail-status').dataset.tone = statusTone(item.status);
    $('search-detail-title').textContent = item.title || `${KIND_LABELS[item.kind] || item.kind} #${item.id}`;
    $('search-detail-summary').textContent = item.summary || `ID ${item.id}`;
    renderSearchUsers(item, Array.isArray(detail.users) ? detail.users : []);
    renderSearchMedia(item, Array.isArray(detail.media) ? detail.media : []);
    renderSearchEvidence(normalizeJSON(detail.evidence));
    renderSearchReports(Array.isArray(detail.related_reports) ? detail.related_reports : []);
    renderSearchSanctions(Array.isArray(detail.sanction_history) ? detail.sanction_history : []);
    setVisible($('search-detail-content'), true);
  }

  function renderSearchUsers(item, users) {
    const section = $('search-users-section');
    const cards = users.map((user) => {
      const card = create('article', 'user-card search-user-card');
      const heading = create('div', 'user-card-heading');
      const identity = create('div', 'user-card-identity');
      const avatar = create('span', 'user-avatar', String(user.name || 'П').trim().slice(0, 1).toUpperCase());
      const title = create('div');
      title.append(create('span', 'user-relation', userRelationLabel(item, user.relation)), create('h3', '', user.name || `Пользователь #${user.id}`), create('small', '', `ID ${user.id}`));
      identity.append(avatar, title);
      const accountStatus = userAccountStatus(user);
      const badge = create('span', 'status-badge', accountStatus.label);
      badge.dataset.tone = accountStatus.tone;
      heading.append(identity, badge);
      const fields = create('div', 'user-fields');
      fields.append(
        userField('Почта', user.email), userField('Телефон', user.phone, user.phone_verified ? 'success' : ''),
        userField('Город', user.city), userField('Создан', formatDateTime(user.created_at)),
        userField('Последняя активность', user.last_seen_at ? formatDateTime(user.last_seen_at) : 'Нет данных'),
        userField('Версия приложения', user.last_app_version || 'Нет данных'),
      );
      const metrics = create('div', 'user-metrics');
      metrics.append(
        userMetric(user.listings_total, 'объявлений'), userMetric(user.reviews_authored, 'отзывов'),
        userMetric(user.reports_received, 'жалоб получено'), userMetric(user.reports_submitted, 'жалоб отправлено'),
        userMetric(user.active_sessions, 'активных сессий'), userMetric(user.blocks_received, 'блокировок'),
      );
      card.append(heading, fields, metrics);
      return card;
    });
    $('search-users-list').replaceChildren(...cards);
    setVisible(section, cards.length > 0);
  }

  function searchMediaURL(item, mediaID, variant = 'original') {
    const suffix = variant === 'thumbnail' ? '?variant=thumbnail' : '';
    return `${API_ROOT}/search/${encodeURIComponent(item.kind)}/${encodeURIComponent(item.id)}/media/${encodeURIComponent(mediaID)}${suffix}`;
  }

  function renderSearchMedia(item, media) {
    const section = $('search-media-section');
    const cards = media.map((file) => {
      const card = create('article', 'media-card');
      const mime = String(file.mime_type || 'application/octet-stream').toLowerCase();
      const url = searchMediaURL(item, file.id);
      const visual = create('div', 'media-visual');
      if (mime.startsWith('image/')) {
        const link = create('a', 'media-open');
        link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        const image = create('img');
        image.src = url; image.alt = file.file_name || `Изображение #${file.id}`; image.loading = 'lazy';
        image.addEventListener('error', () => link.replaceChildren(mediaFallback('Изображение недоступно')), { once: true });
        link.append(image); visual.append(link);
      } else if (mime.startsWith('video/')) {
        const video = create('video');
        video.controls = true; video.preload = 'metadata'; video.src = url;
        if (file.has_thumbnail) video.poster = searchMediaURL(item, file.id, 'thumbnail');
        visual.append(video);
      } else {
        const link = create('a', 'media-document');
        link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.append(icon('file'), create('span', '', 'Открыть файл')); visual.append(link);
      }
      const meta = create('div', 'media-card-meta');
      meta.append(create('strong', '', file.file_name || `Файл #${file.id}`), create('span', '', [mime, formatFileSize(file.size_bytes)].filter(Boolean).join(' · ')));
      card.append(visual, meta);
      return card;
    });
    $('search-media-list').replaceChildren(...cards);
    setVisible(section, cards.length > 0);
  }

  function renderSearchEvidence(evidence) {
    const container = $('search-evidence-list');
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) || Object.keys(evidence).length === 0) {
      container.replaceChildren(create('p', 'evidence-empty', 'Снимок данных отсутствует.'));
      return;
    }
    const rows = Object.entries(evidence).filter(([key]) => !['photos', 'url', 'thumbnail_url'].includes(key)).map(([key, value]) => {
      const row = create('div', 'evidence-row');
      row.append(create('dt', '', FIELD_LABELS[key] || humanizeKey(key)));
      const data = create('dd'); appendValue(data, key, value); row.append(data);
      return row;
    });
    container.replaceChildren(...rows);
  }

  function renderSearchReports(reports) {
    const section = $('search-reports-section');
    const cards = reports.map((report) => {
      const card = create('article', 'search-history-card');
      const heading = create('div', 'search-history-heading');
      heading.append(create('strong', '', `Жалоба #${report.id}`));
      const badge = create('span', 'status-badge', statusLabel(report.status)); badge.dataset.tone = statusTone(report.status); heading.append(badge);
      card.append(
        heading,
        create('span', 'search-history-target', `${REPORT_TARGET_LABELS[report.target_type] || report.target_type} #${report.target_id}`),
        create('p', '', report.details || REPORT_REASON_LABELS[report.reason] || report.reason || 'Без комментария'),
        create('small', '', formatDateTime(report.created_at)),
      );
      const open = create('button', 'text-button', 'Открыть жалобу');
      open.type = 'button'; open.addEventListener('click', () => void openSearchReport(report.id)); card.append(open);
      return card;
    });
    $('search-reports-list').replaceChildren(...cards);
    $('search-reports-count').textContent = String(cards.length);
    setVisible(section, cards.length > 0);
  }

  async function openSearchReport(id) {
    await switchView('queue');
    await openDetail('report', id);
  }

  function renderSearchSanctions(sanctions) {
    const section = $('search-sanctions-section');
    const cards = sanctions.map((sanction) => {
      const card = create('article', `search-history-card${sanction.active ? ' is-active' : ''}`);
      const heading = create('div', 'search-history-heading');
      heading.append(create('strong', '', SANCTIONS[sanction.type]?.label || humanizeKey(sanction.type)));
      const badge = create('span', 'status-badge', sanction.active ? 'Действует' : 'Отозвана');
      badge.dataset.tone = sanction.active ? 'danger' : 'success'; heading.append(badge);
      card.append(
        heading,
        create('span', 'search-history-target', `${REPORT_TARGET_LABELS[sanction.target_type] || sanction.target_type} #${sanction.target_id} · Жалоба #${sanction.report_id}`),
        create('p', '', sanction.applied_reason || 'Причина не указана.'),
        create('small', '', `Применил: ${sanction.applied_by_email || `администратор #${sanction.applied_by_admin_id}`} · ${formatDateTime(sanction.applied_at)}`),
      );
      if (!sanction.active) {
        card.append(create('small', 'search-revocation', `Отозвал: ${sanction.revoked_by_email || 'администратор'} · ${formatDateTime(sanction.revoked_at)}${sanction.revocation_reason ? ` · ${sanction.revocation_reason}` : ''}`));
      }
      return card;
    });
    $('search-sanctions-list').replaceChildren(...cards);
    $('search-sanctions-count').textContent = String(cards.length);
    setVisible(section, cards.length > 0);
  }

  async function loadAudit() {
    const requestID = ++state.auditRequest;
    setVisible($('audit-loading'), true);
    setVisible($('audit-error'), false);
    setVisible($('audit-empty'), false);
    setVisible($('audit-pagination'), false);
    const params = new URLSearchParams({ limit: String(AUDIT_LIMIT), offset: String(state.auditOffset) });
    const action = $('audit-action').value;
    if (action) params.set('action', action);
    try {
      const page = await api(`/audit?${params.toString()}`);
      if (requestID !== state.auditRequest) return;
      state.auditItems = page.items || [];
      state.auditTotal = Number(page.total || 0);
      if (state.auditItems.length === 0 && state.auditOffset > 0 && state.auditTotal > 0) {
        state.auditOffset = Math.max(0, Math.floor((state.auditTotal - 1) / AUDIT_LIMIT) * AUDIT_LIMIT);
        await loadAudit();
        return;
      }
      $('audit-total').textContent = String(state.auditTotal);
      renderAudit();
      setVisible($('audit-empty'), state.auditItems.length === 0);
      renderAuditPagination();
    } catch (error) {
      if (requestID !== state.auditRequest || handleSessionError(error)) return;
      $('audit-error').textContent = error.message;
      setVisible($('audit-error'), true);
    } finally {
      if (requestID === state.auditRequest) setVisible($('audit-loading'), false);
    }
  }

  function renderAuditPagination() {
    const hasItems = state.auditItems.length > 0;
    const start = hasItems ? state.auditOffset + 1 : 0;
    const end = hasItems ? state.auditOffset + state.auditItems.length : 0;
    $('audit-page-label').textContent = hasItems ? `${start}–${end} из ${state.auditTotal}` : '';
    $('audit-prev').disabled = state.auditOffset === 0;
    $('audit-next').disabled = end >= state.auditTotal;
    setVisible($('audit-pagination'), state.auditTotal > AUDIT_LIMIT);
  }

  function changeAuditPage(direction) {
    const nextOffset = state.auditOffset + direction * AUDIT_LIMIT;
    if (nextOffset < 0 || nextOffset >= state.auditTotal || nextOffset === state.auditOffset) return;
    state.auditOffset = nextOffset;
    void loadAudit();
    $('audit-view').scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderAudit() {
    const rows = state.auditItems.map((record) => {
      const row = create('article', 'audit-row');
      row.setAttribute('role', 'listitem');

      const primary = create('div', 'audit-primary');
      primary.append(
        create('strong', 'audit-action', auditActionLabel(record.action)),
        create('span', '', record.reason || auditMetadataSummary(record.metadata)),
      );

      const actor = create('div', 'audit-cell');
      actor.append(create('small', '', 'Сотрудник'), create('span', '', record.actor?.email || '—'));

      const target = create('div', 'audit-cell');
      const targetValue = [record.target_type, record.target_id && `#${record.target_id}`].filter(Boolean).join(' ');
      target.append(create('small', '', 'Объект'), create('span', '', targetValue || 'Сессия'));
      if (record.target_type === 'report' && Number(record.target_id) > 0) {
        const open = create('button', 'audit-target-button', 'Открыть карточку');
        open.type = 'button';
        open.addEventListener('click', () => void openAuditTarget('report', Number(record.target_id)));
        target.append(open);
      }

      const time = create('div', 'audit-cell audit-time');
      time.append(create('small', '', 'Дата и IP'), create('span', '', formatDateTime(record.created_at)), create('span', '', record.ip_address || 'IP не сохранён'));
      row.append(primary, actor, target, time);
      return row;
    });
    $('audit-list').replaceChildren(...rows);
  }

  async function openAuditTarget(kind, id) {
    await switchView('queue');
    if (state.filter !== 'reports') {
      state.filter = 'reports';
      updateFilterTabs();
      await loadList();
    }
    await openDetail(kind, id);
  }

  function auditActionLabel(action) {
    if (AUDIT_ACTION_LABELS[action]) return AUDIT_ACTION_LABELS[action];
    if (action.startsWith('admin_inbox.')) {
      const parts = action.split('.');
      const kind = KIND_LABELS[parts[1]] || parts[1] || 'Материал';
      const actionLabel = ACTIONS[parts[2]]?.label || parts[2] || 'Решение';
      return `${kind}: ${actionLabel}`;
    }
    return action;
  }

  function auditMetadataSummary(metadata) {
    const value = normalizeJSON(metadata);
    if (!value || typeof value !== 'object' || Object.keys(value).length === 0) return 'Без дополнительного комментария';
    if (value.email) return value.email;
    if (value.result_status) return `Новый статус: ${statusLabel(value.result_status)}`;
    return compactObject(value);
  }

  async function loadStaff() {
    setVisible($('staff-loading'), true);
    setVisible($('staff-error'), false);
    try {
      const result = await api('/staff');
      state.staff = result.items || [];
      $('staff-total').textContent = String(state.staff.length);
      renderStaff();
    } catch (error) {
      if (handleSessionError(error)) return;
      $('staff-error').textContent = error.message;
      setVisible($('staff-error'), true);
    } finally {
      setVisible($('staff-loading'), false);
    }
  }

  function renderStaff() {
    const rows = state.staff.map((account) => {
      const row = create('article', 'staff-row');
      row.dataset.id = String(account.id);

      const identity = create('div', 'staff-identity');
      identity.append(create('strong', '', account.name || account.email), create('span', '', account.email));

      const meta = create('div', 'staff-meta');
      meta.append(create('span', '', account.last_login_at ? `Вход: ${formatDateTime(account.last_login_at)}` : 'Ещё не входил'));

      const role = create('select', 'staff-role-select');
      role.setAttribute('aria-label', `Роль: ${account.email}`);
      Object.entries(ROLE_LABELS).forEach(([value, label]) => {
        const option = create('option', '', label);
        option.value = value;
        option.selected = value === account.role;
        role.append(option);
      });

      const access = create('label', 'staff-access');
      const checkbox = create('input', 'staff-enabled');
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(account.enabled);
      access.append(checkbox, create('span', '', account.enabled ? 'Доступ включён' : 'Доступ отключён'));
      checkbox.addEventListener('change', () => { access.lastElementChild.textContent = checkbox.checked ? 'Доступ включён' : 'Доступ отключён'; });

      const actions = create('div', 'staff-actions');
      if (Number(account.id) === Number(state.admin.id)) {
        role.disabled = true;
        checkbox.disabled = true;
        actions.append(create('span', 'staff-current', 'Текущая сессия'));
      } else {
        const save = create('button', 'button button-quiet', 'Сохранить');
        save.type = 'button';
        save.addEventListener('click', () => void saveStaff(account, role, checkbox, save));
        actions.append(save);
      }

      row.classList.toggle('is-disabled', !account.enabled);
      row.append(identity, meta, role, access, actions);
      return row;
    });
    $('staff-list').replaceChildren(...rows);
  }

  async function createStaff() {
    const email = $('staff-email').value.trim().toLowerCase();
    const role = $('staff-role').value;
    $('staff-create-error').textContent = '';
    if (!emailValid(email)) {
      $('staff-create-error').textContent = 'Введите почту существующего аккаунта ВИГАЖ.';
      $('staff-email').focus();
      return;
    }
    const button = $('staff-create-button');
    setButtonLoading(button, true);
    try {
      await api('/staff', { method: 'POST', csrf: true, body: { email, role } });
      $('staff-email').value = '';
      toast('Доступ сотруднику добавлен.');
      await loadStaff();
    } catch (error) {
      if (!handleSessionError(error)) $('staff-create-error').textContent = error.message;
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function saveStaff(account, role, checkbox, button) {
    setButtonLoading(button, true);
    try {
      await api(`/staff/${account.id}`, {
        method: 'PATCH', csrf: true, body: { role: role.value, enabled: checkbox.checked },
      });
      toast('Доступ сотрудника обновлён.');
      await loadStaff();
    } catch (error) {
      if (!handleSessionError(error)) toast(error.message, error.status === 409 ? 'warning' : 'error');
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function openDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const kind = params.get('kind');
    const id = Number(params.get('id'));
    if (!VALID_KINDS.has(kind) || !Number.isInteger(id) || id <= 0) return;
    if (state.admin.role === 'support' && kind !== 'report') {
      toast('У вашей роли нет доступа к этой очереди.', 'warning');
      return;
    }
    const filter = kind === 'report' ? 'reports' : kind === 'listing' ? 'listings' : ['review', 'review_reply'].includes(kind) ? 'reviews' : 'attachments';
    if (state.filter !== filter) {
      state.filter = filter;
      updateFilterTabs();
      await loadList();
    }
    await openDetail(kind, id);
  }

  function updateFilterTabs() {
    document.querySelectorAll('.filter-tab').forEach((tab) => {
      const active = tab.dataset.filter === state.filter;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
  }

  function statusLabel(status) {
    return STATUS_LABELS[status] || humanizeKey(status || 'unknown');
  }

  function statusTone(status) {
    if (['active', 'approved', 'resolved'].includes(status)) return 'success';
    if (['rejected', 'dismissed', 'failed', 'disabled', 'deleted', 'hidden'].includes(status)) return 'danger';
    return 'warning';
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  function relativeDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const ranges = [[60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day']];
    let amount = seconds;
    for (const [limit, unit] of ranges) {
      if (Math.abs(amount) < limit) return new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' }).format(Math.round(amount), unit);
      amount /= limit;
    }
    return formatDateTime(value);
  }

  function toast(message, tone = 'success') {
    const element = create('div', `toast${tone === 'success' ? '' : ` is-${tone}`}`);
    element.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    element.append(icon(tone === 'success' ? 'check' : 'alert'), create('span', '', message));
    $('toast-region').append(element);
    window.setTimeout(() => element.remove(), 4600);
  }

  $('email-form').addEventListener('submit', (event) => { event.preventDefault(); void requestCode(); });
  $('code-form').addEventListener('submit', (event) => { event.preventDefault(); void verifyCode(); });
  $('email').addEventListener('input', () => setFieldError($('email'), $('email-error'), ''));
  $('code').addEventListener('input', () => {
    $('code').value = $('code').value.replace(/\D/g, '').slice(0, 6);
    setFieldError($('code'), $('code-error'), '');
  });
  $('change-email-button').addEventListener('click', () => { showAuthStep('email'); $('email').focus(); });
  $('resend-code-button').addEventListener('click', () => void requestCode());
  $('logout-button').addEventListener('click', () => void logout());
  $('refresh-button').addEventListener('click', () => void refreshActiveView(false));
  $('retry-list-button').addEventListener('click', () => void loadList());
  $('retry-detail-button').addEventListener('click', () => state.selected && void openDetail(state.selected.kind, state.selected.id));
  $('detail-back-button').addEventListener('click', closeDetail);
  $('queue-filters').addEventListener('click', (event) => {
    const tab = event.target.closest('.filter-tab');
    if (!tab || tab.hidden || state.filter === tab.dataset.filter) return;
    state.filter = tab.dataset.filter;
    updateFilterTabs();
    closeDetail();
    void loadList();
  });
  $('app-nav').addEventListener('click', (event) => {
    const button = event.target.closest('.app-nav-button');
    if (button && !button.hidden && button.dataset.view !== state.view) void switchView(button.dataset.view);
  });
  $('audit-action').addEventListener('change', () => {
    state.auditOffset = 0;
    void loadAudit();
  });
  $('audit-prev').addEventListener('click', () => changeAuditPage(-1));
  $('audit-next').addEventListener('click', () => changeAuditPage(1));
  $('staff-create-form').addEventListener('submit', (event) => { event.preventDefault(); void createStaff(); });
  $('search-form').addEventListener('submit', (event) => { event.preventDefault(); void runSearch(); });
  $('search-kind').addEventListener('change', () => {
    updateSearchInput();
    $('search-error').hidden = true;
    $('search-query').value = '';
    $('search-query').focus();
  });
  $('action-form').addEventListener('submit', (event) => { event.preventDefault(); void submitAction(); });
  document.querySelectorAll('[data-close-modal]').forEach((element) => element.addEventListener('click', closeActionModal));
  $('action-reason').addEventListener('input', () => {
    const length = $('action-reason').value.length;
    $('reason-count').textContent = `${length} / 2000`;
    $('reason-error').textContent = '';
    $('action-reason').setAttribute('aria-invalid', 'false');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('action-modal').hidden) closeActionModal();
    else if (event.key === 'Escape' && $('detail-pane').classList.contains('is-open')) closeDetail();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.admin) void refreshActiveView(false);
  });
  window.setInterval(() => {
    if (!document.hidden && state.admin && $('action-modal').hidden) void refreshActiveView(false);
  }, 60_000);

  void boot();
})();
