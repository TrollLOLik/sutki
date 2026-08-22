import { ArrowRight, Check, CheckCircle2, Clock3, Eye, FileText, Sparkles, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ListingCard } from '@entities/listing';
import { myListingsRepository } from '@features/my-listings';
import { AppHeader, BadgeText, BodyText, Button, Chip, ChoiceCard, DescriptionText, PageTitle, RouteActionBarPortal, SectionTitle } from '@ui';
import { DesktopTopbar } from '@widgets/app-navigation';

type PromotionKind = 'top' | 'bright';
type PromotionDays = 1 | 7 | 30;

const promotionPrices: Record<PromotionKind, Record<PromotionDays, number>> = {
  top: { 1: 79, 7: 299, 30: 899 },
  bright: { 1: 49, 7: 149, 30: 399 },
};

export function PromotionPage({ listingId, onBack, onOpenListing, onCheckout, onHome, onMap, onMessages, onProfile, onCreate }: {
  listingId?: number;
  onBack: () => void;
  onOpenListing: (listingId: number) => void;
  onCheckout: () => void;
  onHome: () => void;
  onMap: () => void;
  onMessages: () => void;
  onProfile: () => void;
  onCreate: () => void;
}) {
  const listing = useMemo(() => {
    const items = myListingsRepository.getSnapshot();
    return items.find((item) => item.listing.id === listingId) ?? items[0];
  }, [listingId]);
  const [kind, setKind] = useState<PromotionKind>(listing?.listing.promoted === 'highlight' ? 'bright' : 'top');
  const [days, setDays] = useState<PromotionDays>(7);
  const [paymentState, setPaymentState] = useState<'configure' | 'pending' | 'paid'>('configure');
  const price = promotionPrices[kind][days];
  const item = listing?.listing;
  const connectedPromotionKinds = listing?.promotionKinds?.length ? listing.promotionKinds : item?.promoted ? [item.promoted] : [];
  const topConnected = connectedPromotionKinds.includes('top');
  const brightConnected = connectedPromotionKinds.includes('highlight');
  const selectedKindConnected = kind === 'top' ? topConnected : brightConnected;

  useEffect(() => {
    if (paymentState !== 'pending') return;
    const timer = window.setTimeout(() => setPaymentState('paid'), 1400);
    return () => window.clearTimeout(timer);
  }, [paymentState]);

  useEffect(() => {
    if (paymentState === 'paid' && item) myListingsRepository.promote(item.id, kind === 'bright' ? 'highlight' : 'top');
  }, [item, kind, paymentState]);

  const beginPayment = () => {
    onCheckout();
    setPaymentState('pending');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const preview = <section className="promotion-preview-section">
    <div className="promotion-preview-head"><div><SectionTitle>Так увидят гости</SectionTitle><DescriptionText as="p">Превью выбранного оформления</DescriptionText></div><BadgeText><Eye />Превью</BadgeText></div>
    {item ? <div className="promotion-catalog-preview">
      <ListingCard
        listing={{ ...item, promoted: kind === 'bright' ? 'highlight' : 'top' }}
        layout="list"
        mode="plain"
        favorite={false}
        showFavorite={false}
        onToggleFavorite={() => undefined}
        onOpen={() => onOpenListing(item.id)}
      />
    </div> : <DescriptionText className="promotion-listing-missing">Объявление не найдено</DescriptionText>}
  </section>;

  const total = <section className="promotion-total">
    <span><FileText /></span>
    <div><DescriptionText as="p">Итого за {days} {days === 1 ? 'день' : 'дней'}</DescriptionText><BadgeText as="small" weight={400} color="muted">Одно объявление</BadgeText></div>
    <PageTitle as="strong">{price} ₽</PageTitle>
  </section>;

  const footer = <RouteActionBarPortal contextClassName="promotion-page">
    <footer className="promotion-footer">
      {paymentState === 'configure' && selectedKindConnected ? <Button className="primary-button" size="md" mode="solid" tone="primary" startIcon={<Check />} onClick={onBack}>Готово</Button> : null}
      {paymentState === 'configure' && !selectedKindConnected ? <Button className="primary-button" size="md" mode="solid" tone="primary" startIcon={<ArrowRight />} onClick={beginPayment}>Перейти к оплате</Button> : null}
      {paymentState === 'paid' ? <Button className="primary-button" size="md" mode="solid" tone="primary" startIcon={<Check />} onClick={onBack}>Готово</Button> : null}
    </footer>
  </RouteActionBarPortal>;

  return (
    <div className="promotion-page-shell">
      <DesktopTopbar className="promotion-desktop-topbar" onSearch={onHome} onMap={onMap} onMessages={onMessages} onProfile={onProfile} onCreate={onCreate} />
      <main className={`promotion-page is-${paymentState}`}>
      <AppHeader className="promotion-header" title={<PageTitle as="span">Продвижение</PageTitle>} onBack={onBack} />

      {paymentState === 'configure' ? <div className="promotion-config-grid">
        <div className="promotion-settings-column">
          <section className="promotion-intro">
            <SectionTitle>Сделайте объявление заметнее</SectionTitle>
            <DescriptionText as="p">Выберите способ и срок. Продвижение начнётся после одобрения объявления модерацией.</DescriptionText>
          </section>

          <section className="promotion-section">
            <SectionTitle>Способ продвижения</SectionTitle>
            <div className="promotion-kind-grid">
              <ChoiceCard selected={kind === 'top'} icon={<TrendingUp />} iconClassName="promotion-kind-icon" title="Выше в поиске" description="Приоритет среди продвигаемых объявлений" meta={topConnected ? <BadgeText color="inherit"><CheckCircle2 />Подключено</BadgeText> : undefined} metaClassName="promotion-kind-connected" onClick={() => setKind('top')} />
              <ChoiceCard selected={kind === 'bright'} className="bright" icon={<Sparkles />} iconClassName="promotion-kind-icon" title="Яркая карточка" description="Эффект ЛУЧШЕЕ и заметное оформление" meta={brightConnected ? <BadgeText color="inherit"><CheckCircle2 />Подключено</BadgeText> : undefined} metaClassName="promotion-kind-connected" onClick={() => setKind('bright')} />
            </div>
          </section>

          <section className="promotion-section">
            <SectionTitle>Срок продвижения</SectionTitle>
            <div className="promotion-days" role="radiogroup" aria-label="Срок продвижения">
              {([1, 7, 30] as const).map((value) => (
                <Chip role="radio" aria-checked={days === value} selected={days === value} key={value} onClick={() => setDays(value)}>{value} {value === 1 ? 'день' : 'дней'}</Chip>
              ))}
            </div>
          </section>
        </div>

        <aside className="promotion-preview-column">
          {preview}
          {total}
          {selectedKindConnected ? <div className="promotion-connected-banner"><CheckCircle2 />Этот тип продвижения уже подключён.</div> : null}
          {footer}
        </aside>
      </div> : <div className="promotion-result-grid">
        <aside className="promotion-preview-column">{preview}{total}{footer}</aside>
        {paymentState === 'pending' ? <section className="promotion-payment-state is-pending"><span><Clock3 /></span><SectionTitle>Ожидаем подтверждение</SectionTitle><DescriptionText as="p">Статус обновится автоматически после подтверждения оплаты.</DescriptionText></section> : null}
        {paymentState === 'paid' ? <section className="promotion-payment-state is-paid"><span><Check /></span><SectionTitle>Продвижение подключено</SectionTitle><DescriptionText as="p">Карточка участвует в продвижении.</DescriptionText></section> : null}
      </div>}
      </main>
    </div>
  );
}
