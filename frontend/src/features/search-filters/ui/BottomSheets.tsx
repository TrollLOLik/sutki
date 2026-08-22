import {
  CalendarDays,
  Check,
  Heart,
  Home,
  Globe2,
  MapPin,
  Minus,
  Plus,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  categoryOptions,
  defaultFilters,
  formatDateRange,
  formatGuests,
  pluralVariants,
  roomOptions,
  serviceOptions,
  sortOptions,
  toggleItem,
  type SearchFilters,
} from '@shared/types/filters';
import { CalendarRange, type DateRangeValue } from './CalendarRange';
import { scrollToFirstValidationError } from '@shared/lib/forms/scrollToValidationError';
import { BodyText, BottomSheet, Button, Chip, Counter, DescriptionText, Divider, DualRange, FullPageModal, FullPageModalReset, IconButton, ListCell, Modal, ScrollArea, SearchField, SectionTitle, SegmentedControl, TextField, ToggleCard } from '@ui';

export function GuestSheet({ open = true, value, max = 100, onClose, onApply }: { open?: boolean; value: number; max?: number; onClose: () => void; onApply: (value: number) => void }) {
  const [count, setCount] = useState(value);
  useEffect(() => { if (open) setCount(value); }, [open, value]);
  return (
    <BottomSheet open={open} title="Количество гостей" onClose={onClose} desktopPresentation="modal" className="guest-picker-sheet" bodyClassName="guest-picker-body" headerStart={<span aria-hidden="true" />} footer={<Button size="lg" stretched onClick={() => onApply(count)}>Применить</Button>}>
      <Counter value={count} min={1} max={max} label="Количество гостей" onChange={setCount} />
    </BottomSheet>
  );
}

export function DateSheet({
  open = true,
  checkIn,
  checkOut,
  minDate,
  maxDate,
  desktopNested = false,
  onClose,
  onApply,
}: {
  open?: boolean;
  checkIn: string | null;
  checkOut: string | null;
  minDate?: string;
  maxDate?: string;
  desktopNested?: boolean;
  onClose: () => void;
  onApply: (checkIn: string | null, checkOut: string | null) => void;
}) {
  const [range, setRange] = useState<DateRangeValue>({ start: checkIn, end: checkOut });
  useEffect(() => { if (open) setRange({ start: checkIn, end: checkOut }); }, [checkIn, checkOut, open]);
  const apply = () => {
    const start = range.start;
    const end = start ? range.end ?? nextIsoDay(start) : null;
    onApply(start, end);
  };

  return (
    <BottomSheet open={open} title="Выберите даты" desktopPresentation="modal" desktopNested={desktopNested} className="date-picker-sheet" bodyClassName="date-picker-sheet-content" headerStart={<Button className="filter-header-reset" size="sm" mode="ghost" tone="primary" onClick={() => setRange({ start: null, end: null })}>Сбросить</Button>} onClose={onClose} footer={<Button size="lg" stretched onClick={apply}>Применить</Button>}>
      <CalendarRange value={range} onChange={setRange} minDate={minDate} maxDate={maxDate} />
    </BottomSheet>
  );
}

function nextIsoDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const next = new Date(year, month - 1, day + 1, 12);
  return `${next.getFullYear()}-${`${next.getMonth() + 1}`.padStart(2, '0')}-${`${next.getDate()}`.padStart(2, '0')}`;
}

const cities = ['Магнитогорск', 'Челябинск', 'Казань', 'Екатеринбург', 'Санкт-Петербург', 'Москва', 'Краснодар', 'Нижний Новгород', 'Новосибирск', 'Уфа'];

export function CityPickerSheet({ open, value, allowAny = true, autoFocus = true, onClose, onSelect }: { open: boolean; value: string | null; allowAny?: boolean; autoFocus?: boolean; onClose: () => void; onSelect: (value: string | null) => void }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const visible = debouncedQuery
    ? cities.filter((city) => city.toLocaleLowerCase('ru').includes(debouncedQuery.toLocaleLowerCase('ru')))
    : [];
  return (
    <Modal open={open} title="Выберите город" description="Начните вводить название" icon={<MapPin />} onClose={onClose} size="md" className="city-picker-sheet" bodyClassName="city-picker-body">
        <SearchField size="lg" autoFocus={autoFocus} value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery('')} placeholder="Поиск города..." aria-label="Поиск города" />
        {allowAny ? <Button className="city-picker-any" size="md" mode="ghost" tone="neutral" startIcon={<Globe2 size={18} />} onClick={() => onSelect(null)}>Любой город</Button> : null}
        <ScrollArea className="filter-option-stack" ariaLabel="Список городов">
          {!debouncedQuery ? <DescriptionText as="p" className="filter-option-message">Начните вводить название города</DescriptionText> : null}
          {visible.map((city) => <Button className={value === city ? 'selected' : ''} size="md" mode="ghost" tone={value === city ? 'primary' : 'neutral'} key={city} endIcon={value === city ? <Check size={19} /> : undefined} onClick={() => onSelect(city)}>{city}</Button>)}
          {debouncedQuery && !visible.length ? <DescriptionText as="p" className="filter-option-message">Города не найдены</DescriptionText> : null}
        </ScrollArea>
    </Modal>
  );
}
function formatNumber(value: number | null): string {
  return value == null ? '' : value.toLocaleString('ru-RU');
}

function parseNumber(value: string): number | null {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

function NumberField({
  prefix,
  ariaLabel,
  value,
  placeholder,
  onChange,
  onBlur,
}: {
  prefix: string;
  ariaLabel: string;
  value: number | null;
  placeholder: string;
  onChange: (value: number | null) => void;
  onBlur?: () => void;
}) {
  return (
    <TextField className="filter-number-field" size="md" before={<DescriptionText className="ui-text--inherit-metrics" color="inherit">{prefix}</DescriptionText>} inputMode="numeric" aria-label={ariaLabel} value={formatNumber(value)} placeholder={placeholder} onBlur={onBlur} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(parseNumber(event.target.value))} />
  );
}
export function FilterSheet({
  open,
  value,
  resultCount,
  hideOwnListingsToggle = false,
  extraSection,
  onResetExtra,
  onClose,
  onApply,
}: {
  open: boolean;
  value: SearchFilters;
  resultCount: (filters: SearchFilters) => number;
  hideOwnListingsToggle?: boolean;
  extraSection?: ReactNode;
  onResetExtra?: () => void;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
}) {
  const [draft, setDraft] = useState<SearchFilters>(value);
  const [picker, setPicker] = useState<null | 'city' | 'dates'>(null);

  useEffect(() => {
    if (open) {
      setDraft(value);
    }
  }, [open, value]);

  const total = useMemo(() => resultCount(draft), [draft, resultCount]);
  const priceMin = draft.priceMin ?? 0;
  const priceMax = draft.priceMax ?? 15000;
  const areaInvalid =
    (draft.areaMin != null && draft.areaMin > 10000) ||
    (draft.areaMax != null && draft.areaMax > 10000) ||
    (draft.areaMin != null && draft.areaMax != null && draft.areaMin > draft.areaMax);
  const invalid = areaInvalid;

  const patch = (next: Partial<SearchFilters>) => setDraft((current) => ({ ...current, ...next }));
  const commitPriceMin = () => {
    const nextMin = Math.min(15000, Math.max(0, draft.priceMin ?? 0));
    const currentMax = draft.priceMax ?? 15000;
    patch({ priceMin: nextMin, priceMax: nextMin > currentMax - 500 ? Math.min(15000, nextMin + 500) : draft.priceMax });
  };
  const commitPriceMax = () => {
    const nextMax = Math.min(15000, Math.max(0, draft.priceMax ?? 15000));
    const currentMin = draft.priceMin ?? 0;
    patch({ priceMax: nextMax, priceMin: nextMax < currentMin + 500 ? Math.max(0, nextMax - 500) : draft.priceMin });
  };

  const closeFilters = () => {
    if (!open) return;
    onClose();
  };
  const applyFilters = () => {
    if (invalid) {
      scrollToFirstValidationError(document.getElementById('listing-filter-panel'));
      return;
    }
    onApply(draft);
  };

  return (
    <FullPageModal
      open={open}
      onClose={closeFilters}
      title="Фильтры"
      layerClassName="filter-layer"
      backdropClassName="filter-backdrop"
      className={`filter-panel ${picker ? 'is-replaced' : ''}`}
      headerClassName="filter-panel-header"
      headerEnd={<FullPageModalReset onClick={() => { setDraft(defaultFilters); onResetExtra?.(); }} />}
      footerClassName="filter-panel-footer"
      footer={<Button className="primary-button" size="lg" mode="solid" tone="primary" stretched disabled={invalid} onClick={applyFilters}>{invalid ? 'Проверьте диапазон площади' : `Показать ${total} ${pluralVariants(total)}`}</Button>}
      id="listing-filter-panel"
    >
        <ScrollArea className="filter-panel-scroll" ariaLabel="Параметры фильтрации">
          <div className="filter-layout-grid">
            <div className="filter-column">
              <section className="filter-card">
                <SectionTitle as="h3">Сортировка</SectionTitle>
                <SegmentedControl className="filter-segmented" ariaLabel="Сортировка объявлений" value={draft.sort} options={sortOptions.map((option) => ({ ...option, label: <DescriptionText weight={500} color="inherit">{option.label}</DescriptionText> }))} onChange={(sort) => patch({ sort })} />
              </section>

              <ToggleCard checked={draft.favoritesOnly} icon={<Heart size={20} fill={draft.favoritesOnly ? 'currentColor' : 'none'} />} title="Только избранные" description="Показывать объявления, отмеченные сердечком" onChange={() => patch({ favoritesOnly: !draft.favoritesOnly })} />
              {!hideOwnListingsToggle ? <ToggleCard checked={draft.showOwnListings} icon={<Home size={20} />} title="Показывать мои объявления" description="Добавить ваши объявления в общую выдачу" onChange={() => patch({ showOwnListings: !draft.showOwnListings })} /> : null}
              {extraSection}

              <section className="filter-card filter-navigation-card">
                <ListCell before={<MapPin size={20} />} eyebrow="Город" title={draft.city ?? 'Любой'} onClick={() => setPicker('city')} />
                <Divider className="filter-navigation-divider" />
                <ListCell before={<CalendarDays size={20} />} eyebrow="Даты проживания" title={formatDateRange(draft.checkIn, draft.checkOut)} onClick={() => setPicker('dates')} />
              </section>

              <section className="filter-card filter-spaced-card">
                <div className="filter-section">
                  <SectionTitle as="h3">Цена за сутки, ₽</SectionTitle>
                  <div className="number-field-grid">
                    <NumberField prefix="от" ariaLabel="Минимальная цена за сутки" value={draft.priceMin} placeholder="0" onBlur={commitPriceMin} onChange={(priceMin) => patch({ priceMin })} />
                    <NumberField prefix="до" ariaLabel="Максимальная цена за сутки" value={draft.priceMax} placeholder="15 000" onBlur={commitPriceMax} onChange={(priceMax) => patch({ priceMax })} />
                  </div>
                  <DualRange min={0} max={15000} valueMin={priceMin} valueMax={priceMax} step={100} minDistance={500} onChange={(nextMin, nextMax) => patch({ priceMin: nextMin, priceMax: nextMax })} />
                </div>
                <div className="filter-section" data-validation-error={areaInvalid ? 'true' : undefined}>
                  <SectionTitle as="h3">Площадь, м²</SectionTitle>
                  <div className="number-field-grid">
                    <NumberField prefix="от" ariaLabel="Минимальная площадь" value={draft.areaMin} placeholder="5" onChange={(areaMin) => patch({ areaMin })} />
                    <NumberField prefix="до" ariaLabel="Максимальная площадь" value={draft.areaMax} placeholder="10 000" onChange={(areaMax) => patch({ areaMax })} />
                  </div>
                </div>
              </section>
            </div>

            <div className="filter-column">
              <section className="filter-card filter-spaced-card">
                <div className="filter-section">
                  <SectionTitle as="h3">Тип жилья</SectionTitle>
                  <div className="chip-grid">
                    {categoryOptions.map((option) => <Chip selected={draft.categoryId === option.value} key={option.value} onClick={() => patch({ categoryId: draft.categoryId === option.value ? null : option.value })}><DescriptionText weight={500} color="inherit">{option.label}</DescriptionText></Chip>)}
                  </div>
                </div>
                <div className="filter-section">
                  <SectionTitle as="h3">Комнаты</SectionTitle>
                  <div className="chip-grid room-chip-grid">
                    {roomOptions.map((option) => <Chip shape={option.value === 'studio' ? 'pill' : 'circle'} selected={draft.rooms.includes(option.value)} key={option.value} onClick={() => patch({ rooms: toggleItem(draft.rooms, option.value) })}><DescriptionText weight={500} color="inherit">{option.label}</DescriptionText></Chip>)}
                  </div>
                </div>
                <div className="filter-section">
                  <SectionTitle as="h3">Гости</SectionTitle>
                  <div className="inline-counter"><BodyText>{formatGuests(draft.guests)}</BodyText><div><IconButton label="Уменьшить количество гостей" size="sm" mode="soft" tone="neutral" disabled={draft.guests <= 1} icon={<Minus size={18} />} onClick={() => patch({ guests: Math.max(1, draft.guests - 1) })} /><BodyText as="strong" weight={500}>{draft.guests}</BodyText><IconButton label="Увеличить количество гостей" size="sm" mode="soft" tone="neutral" disabled={draft.guests >= 100} icon={<Plus size={18} />} onClick={() => patch({ guests: Math.min(100, draft.guests + 1) })} /></div></div>
                </div>
              </section>

              <section className="filter-card filter-spaced-card">
                <div className="filter-section">
                  <SectionTitle as="h3">Правила дома</SectionTitle>
                  <div className="chip-grid">
                    <Chip selected={draft.smokingAllowed} onClick={() => patch({ smokingAllowed: !draft.smokingAllowed })}><DescriptionText weight={500} color="inherit">Можно курить</DescriptionText></Chip>
                    <Chip selected={draft.petsAllowed} onClick={() => patch({ petsAllowed: !draft.petsAllowed })}><DescriptionText weight={500} color="inherit">Можно с животными</DescriptionText></Chip>
                    <Chip selected={draft.childrenAllowed} onClick={() => patch({ childrenAllowed: !draft.childrenAllowed })}><DescriptionText weight={500} color="inherit">Можно с детьми</DescriptionText></Chip>
                    <Chip selected={draft.eventsAllowed} onClick={() => patch({ eventsAllowed: !draft.eventsAllowed })}><DescriptionText weight={500} color="inherit">Разрешены мероприятия</DescriptionText></Chip>
                  </div>
                </div>
                <div className="filter-section">
                  <SectionTitle as="h3">Удобства</SectionTitle>
                  <div className="chip-grid">
                    {serviceOptions.map((service) => <Chip selected={draft.serviceIds.includes(service.id)} key={service.id} onClick={() => patch({ serviceIds: toggleItem(draft.serviceIds, service.id) })}><DescriptionText weight={500} color="inherit">{service.label}</DescriptionText></Chip>)}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </ScrollArea>

        <CityPickerSheet open={picker === 'city'} value={draft.city} onClose={() => setPicker(null)} onSelect={(city) => { patch({ city }); setPicker(null); }} />
        <DateSheet open={picker === 'dates'} checkIn={draft.checkIn} checkOut={draft.checkOut} desktopNested onClose={() => setPicker(null)} onApply={(checkIn, checkOut) => { patch({ checkIn, checkOut }); setPicker(null); }} />
    </FullPageModal>
  );
}
