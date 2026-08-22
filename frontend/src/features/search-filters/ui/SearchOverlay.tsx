import { Clock3, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Button, DescriptionText, FullPageModal, ListCell, ScrollArea, SearchField } from '@ui';

const destinations = [
  ['Москва', 'Столица России'],
  ['Санкт-Петербург', 'Культурная столица'],
  ['Казань', 'Третья столица'],
  ['Сочи', 'Курортный город'],
  ['Краснодар', 'Южный мегаполис'],
] as const;

const cities = ['Магнитогорск', 'Москва', 'Санкт-Петербург', 'Казань', 'Сочи', 'Краснодар', 'Екатеринбург'];

export function SearchOverlay({
  open,
  initialValue,
  onClose,
  onSelect,
  onSubmit,
}: {
  open: boolean;
  initialValue: string;
  onClose: () => void;
  onSelect: (value: string) => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [suggestionQuery, setSuggestionQuery] = useState(initialValue);
  const [recent, setRecent] = useState(['Магнитогорск']);

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    setSuggestionQuery(initialValue);
    try {
      const stored = window.localStorage.getItem('catalog-recent-searches');
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) setRecent(parsed.filter((item): item is string => typeof item === 'string').slice(0, 5));
      }
    } catch {
      // Keep the local defaults when storage is unavailable or invalid.
    }
  }, [open, initialValue]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSuggestionQuery(value), 180);
    return () => window.clearTimeout(timer);
  }, [value]);

  const suggestions = useMemo(() => {
    const query = suggestionQuery.trim().toLocaleLowerCase('ru');
    if (!query) return [];
    return cities.filter((city) => city.toLocaleLowerCase('ru').includes(query));
  }, [suggestionQuery]);

  const remember = (nextValue: string) => {
    setRecent((current) => {
      const next = [nextValue, ...current.filter((item) => item !== nextValue)].slice(0, 5);
      try { window.localStorage.setItem('catalog-recent-searches', JSON.stringify(next)); } catch { /* Keep session history. */ }
      return next;
    });
  };

  const selectValue = (nextValue: string) => {
    remember(nextValue);
    onSelect(nextValue);
  };

  return (
    <FullPageModal
      open={open}
      onClose={onClose}
      title="Поиск"
      layerClassName="overlay-layer"
      backdropClassName="search-overlay-backdrop"
      className="search-overlay-panel"
      headerClassName="search-overlay-title-header"
      headerAfter={(
        <form
          className="search-overlay-search"
          role="search"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (value.trim()) {
              const query = value.trim();
              remember(query);
              onSubmit(query);
            }
          }}
        >
          <SearchField
            className="overlay-search-field"
            size="md"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onClear={() => setValue('')}
            placeholder="Город, адрес или название"
            aria-label="Город, адрес или название"
            autoFocus={open}
          />
        </form>
      )}
    >
        <ScrollArea className="overlay-results" ariaLabel="Результаты поиска">
          <div className="overlay-results-content">
            {value.trim() ? (
              <section>
                <DescriptionText as="h3" color="secondary">ГОРОДА</DescriptionText>
                <div className="result-stack">
                  {suggestions.map((city) => <Result key={city} icon={<TrendingUp size={20} />} title={city} onClick={() => selectValue(city)} />)}
                  {!suggestions.length ? <DescriptionText as="p" className="no-result">Город не найден. Нажмите «ввод», чтобы искать по адресу.</DescriptionText> : null}
                </div>
              </section>
            ) : (
              <>
                {recent.length ? (
                  <section>
                    <div className="section-heading-row">
                      <DescriptionText as="h3" color="secondary">НЕДАВНИЕ ЗАПРОСЫ</DescriptionText>
                      <Button size="sm" mode="ghost" tone="primary" onClick={() => { setRecent([]); try { window.localStorage.removeItem('catalog-recent-searches'); } catch { /* Already cleared in memory. */ } }}>Очистить</Button>
                    </div>
                    <div className="result-stack">
                      {recent.map((item) => <Result key={item} icon={<Clock3 size={20} />} title={item} onClick={() => selectValue(item)} />)}
                    </div>
                  </section>
                ) : null}
                <section className="popular-section">
                  <DescriptionText as="h3" color="secondary">ПОПУЛЯРНЫЕ НАПРАВЛЕНИЯ</DescriptionText>
                  <div className="result-stack">
                    {destinations.map(([name, description]) => <Result key={name} icon={<TrendingUp size={20} />} title={name} subtitle={description} onClick={() => selectValue(name)} />)}
                  </div>
                </section>
              </>
            )}
          </div>
        </ScrollArea>
    </FullPageModal>
  );
}

function Result({ icon, title, subtitle, onClick }: { icon: ReactNode; title: string; subtitle?: string; onClick: () => void }) {
  return <ListCell className="search-result-item" before={icon} title={title} subtitle={subtitle} onClick={onClick} />;
}
