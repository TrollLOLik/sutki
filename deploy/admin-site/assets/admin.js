(() => {
  'use strict';

  const API_ROOT = '/api/admin/v1';
  const PAGE_LIMIT = 100;
  const AUDIT_LIMIT = 50;
  const VALID_KINDS = new Set(['report', 'listing', 'review', 'review_reply', 'attachment']);
  const FILTER_KINDS = {
    all: [''],
    reports: ['report'],
    listings: ['listing'],
    reviews: ['review', 'review_reply'],
    attachments: ['attachment'],
  };
  const KIND_LABELS = {
    report: 'Жалоба',
    listing: 'Объявление',
    review: 'Отзыв',
    review_reply: 'Ответ на отзыв',
    attachment: 'Вложение',
  };
  const ROLE_LABELS = {
    support: 'Поддержка',
    moderator: 'Модератор',
    owner: 'Владелец',
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
    if (!isOwner && state.view !== 'queue') state.view = 'queue';
    updateAppView();

    const supportOnly = state.admin.role === 'support';
    document.querySelectorAll('.filter-tab').forEach((tab) => {
      const hidden = supportOnly && !['all', 'reports'].includes(tab.dataset.filter);
      tab.hidden = hidden;
    });
    if (supportOnly && !['all', 'reports'].includes(state.filter)) state.filter = 'all';
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
    $('detail-kind').textContent = KIND_LABELS[item.kind] || item.kind;
    $('detail-status').textContent = statusLabel(item.status);
    $('detail-status').dataset.tone = statusTone(item.status);
    $('detail-title').textContent = item.title;
    $('detail-summary').textContent = item.summary || item.reason || 'Дополнительное описание отсутствует.';
    renderMeta(item);
    renderTimeline(item);
    renderEvidence(normalizeJSON(detail.evidence));
    $('diagnostics-json').textContent = JSON.stringify(normalizeJSON(detail.context), null, 2);
    renderActions(item);
    setVisible($('detail-content'), true);
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

  function renderEvidence(evidence) {
    const container = $('evidence-content');
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) || Object.keys(evidence).length === 0) {
      container.replaceChildren(create('p', 'evidence-empty', 'Снимок данных для этого элемента отсутствует.'));
      return;
    }
    const fragment = document.createDocumentFragment();
    Object.entries(evidence).forEach(([key, value]) => {
      const row = create('div', 'evidence-row');
      row.append(create('dt', '', FIELD_LABELS[key] || humanizeKey(key)));
      const data = create('dd');
      appendValue(data, key, value);
      row.append(data);
      fragment.append(row);
    });
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
      return item.status === 'new' ? ['start_review', 'resolve', 'dismiss'] : ['resolve', 'dismiss'];
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
    if (config.required && !reason) {
      $('reason-error').textContent = 'Укажите причину решения.';
      $('action-reason').setAttribute('aria-invalid', 'true');
      $('action-reason').focus();
      return;
    }
    const button = $('confirm-action-button');
    setButtonLoading(button, true);
    try {
      await api(`/inbox/${encodeURIComponent(state.selected.kind)}/${state.selected.id}/actions`, {
        method: 'POST', csrf: true, body: { action: state.pendingAction, reason },
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
    if (!['queue', 'audit', 'staff'].includes(view)) return;
    if (view !== 'queue' && state.admin.role !== 'owner') return;
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
      else await refreshWorkspace(followDeepLink);
    } catch (error) {
      if (!handleSessionError(error)) toast(error.message, 'error');
    } finally {
      $('refresh-button').classList.remove('is-spinning');
    }
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

      const time = create('div', 'audit-cell audit-time');
      time.append(create('small', '', 'Дата и IP'), create('span', '', formatDateTime(record.created_at)), create('span', '', record.ip_address || 'IP не сохранён'));
      row.append(primary, actor, target, time);
      return row;
    });
    $('audit-list').replaceChildren(...rows);
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
    if (['rejected', 'dismissed', 'failed'].includes(status)) return 'danger';
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
