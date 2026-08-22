import { AlertCircle, Camera, ChevronLeft, ChevronRight, ImagePlus, List, Sparkles, Sun, X } from 'lucide-react';
import type { ChangeEvent, RefObject } from 'react';
import { BadgeText, BodyText, Button, DescriptionText, HiddenFileInput, IconButton, Pressable } from '@ui';
import type { ListingPhoto, ValidationError } from '../model/createListingDraft';
import { HintCard, PhotoTip } from './CreateListingParts';

interface ListingPhotosStepProps {
  photos: ListingPhoto[];
  error: ValidationError | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onPhotosChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onMakeCover: (id: string) => void;
  onRemovePhoto: (id: string) => void;
  onMovePhoto: (index: number, direction: -1 | 1) => void;
}

export function ListingPhotosStep({ photos, error, fileInputRef, onPhotosChange, onMakeCover, onRemovePhoto, onMovePhoto }: ListingPhotosStepProps) {
  return (
    <div id="create-photos" className="create-step-panel" data-validation-error={error?.anchor === 'create-photos' ? 'true' : undefined}>
      <HintCard title="Как сделать хорошие фотографии" text="Качественные фотографии привлекают больше внимания и помогают быстрее сдать жильё." />
      <div className="create-photo-tips">
        <PhotoTip Icon={Sun} title="Хорошее освещение" text="Используйте дневной свет и включите дополнительное освещение." />
        <PhotoTip Icon={Sparkles} title="Порядок и чистота" text="Уберите лишние вещи, наведите порядок и проверьте чистоту перед съёмкой." />
        <PhotoTip Icon={Camera} title="Обложка объявления" text="Выберите самое удачное фото — оно будет первым, что увидят гости в поиске." />
        <PhotoTip Icon={List} title="Рекомендуемый порядок" text="Начните с основных комнат, затем кухня и санузел, в конце — детали и вид из окна." />
      </div>
      <HiddenFileInput ref={fileInputRef} className="create-file-input" accept="image/jpeg,image/png,image/webp" multiple onChange={onPhotosChange} />
      <div className="create-photo-section-head"><BodyText as="strong" weight={500}>Фотографии ({photos.length} / 10)</BodyText>{photos.length > 0 && photos.length < 10 ? <Button size="sm" mode="ghost" tone="primary" onClick={() => fileInputRef.current?.click()}>Добавить ещё</Button> : null}</div>
      {photos.length === 0 ? (
        <Pressable className="create-photo-dropzone" onClick={() => fileInputRef.current?.click()}><span><ImagePlus size={36} /></span><BodyText as="strong" weight={500}>Добавить фотографии</BodyText><DescriptionText as="small">Выберите до 10 фотографий жилья. Первая выбранная станет обложкой объявления.</DescriptionText></Pressable>
      ) : (
        <div className="create-photo-grid">
          {photos.map((photo, index) => (
            <article key={photo.id} className={`create-photo-item ${index === 0 ? 'cover' : ''}`}>
              <img src={photo.url} alt={`Фотография ${index + 1}`} />
              {index === 0 ? <BadgeText className="create-cover-badge" color="inverse">Главное</BadgeText> : <Button size="sm" mode="soft" tone="neutral" className="create-make-cover" onClick={() => onMakeCover(photo.id)}>На обложку</Button>}
              {photo.status === 'checking' ? <span className="create-photo-checking"><i /><BadgeText as="b" color="inverse">Проверка…</BadgeText></span> : null}
              {photo.status === 'error' ? <span className="create-photo-checking is-error"><AlertCircle /><BadgeText as="b" color="inverse">Ошибка</BadgeText></span> : null}
              <IconButton variant="plain" className="create-remove-photo" label="Удалить фотографию" icon={<X size={15} />} onClick={() => onRemovePhoto(photo.id)} />
              <div className="create-photo-order"><IconButton variant="plain" disabled={index === 0} label="Переместить влево" icon={<ChevronLeft size={16} />} onClick={() => onMovePhoto(index, -1)} /><IconButton variant="plain" disabled={index === photos.length - 1} label="Переместить вправо" icon={<ChevronRight size={16} />} onClick={() => onMovePhoto(index, 1)} /></div>
            </article>
          ))}
        </div>
      )}
      <BadgeText as="p" className="create-photo-optional" weight={400} color="muted">Можно опубликовать объявление без фотографий.</BadgeText>
    </div>
  );
}
