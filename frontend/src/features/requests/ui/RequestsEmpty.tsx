import { Clock3, RotateCcw, Search } from 'lucide-react';
import { EmptyState } from '@ui';
import type { RequestDirection } from '../model/types';
import type { RequestTab } from './types';

export function RequestsEmpty({ mode, tab, query }: { mode: RequestDirection; tab: RequestTab; query: string }) {
  const title = query
    ? 'Ничего не найдено'
    : tab === 'current'
      ? mode === 'incoming' ? 'Новых заявок нет' : 'Активных броней нет'
      : 'История пуста';
  const description = query
    ? 'Попробуйте изменить поисковый запрос.'
    : tab === 'current'
      ? mode === 'incoming' ? 'Здесь появятся заявки, ожидающие вашего решения.' : 'Выберите объявление и оставьте заявку на аренду.'
      : mode === 'incoming'
        ? 'Здесь появятся обработанные заявки.'
        : 'Здесь появятся завершённые и отменённые бронирования.';
  const icon = query ? <Search size={40} /> : tab === 'current' ? <Clock3 size={40} /> : <RotateCcw size={40} />;
  return <EmptyState className="requests-empty" icon={icon} title={title} description={description} />;
}
