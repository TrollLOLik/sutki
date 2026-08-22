import { ArrowLeft, Camera, Image as ImageIcon, RotateCw, Trash2, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { BodyText, Button, ConfirmationDialog, DescriptionText, HiddenFileInput, IconButton, OverlaySurface } from '@ui';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MIN_CROP_SIZE = 96;

type CropRect = { x: number; y: number; size: number };
type CropGesture = { mode: 'move' | 'resize'; pointerId: number; startX: number; startY: number; rect: CropRect; width: number; height: number };

export function ProfileAvatarEditor({
  value,
  onChange,
  onError,
  variant = 'auth',
  emptyContent,
}: {
  value: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
  variant?: 'auth' | 'profile' | 'settings';
  emptyContent?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const readTokenRef = useRef(0);
  const editTokenRef = useRef(0);
  const cropSourceRef = useRef('');
  const cropImageRef = useRef<HTMLImageElement>(null);
  const cropGestureRef = useRef<CropGesture | null>(null);
  const cropBoundsRef = useRef({ width: 0, height: 0 });
  const [actionsOpen, setActionsOpen] = useState(false);
  const [cropSource, setCropSource] = useState('');
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const image = cropImageRef.current;
    if (!image || !cropSource || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const width = image.clientWidth;
      const height = image.clientHeight;
      if (width <= 0 || height <= 0) return;
      setCropRect((current) => {
        const previous = cropBoundsRef.current;
        cropBoundsRef.current = { width, height };
        if (!current || previous.width <= 0 || previous.height <= 0) return current;
        const size = clamp(current.size * Math.min(width / previous.width, height / previous.height), Math.min(MIN_CROP_SIZE, width, height), Math.min(width, height));
        return {
          x: clamp(current.x * (width / previous.width), 0, width - size),
          y: clamp(current.y * (height / previous.height), 0, height - size),
          size,
        };
      });
    });
    observer.observe(image);
    return () => observer.disconnect();
  }, [cropSource]);

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const readToken = ++readTokenRef.current;
    if (!ALLOWED_TYPES.has(file.type)) return onError('Выберите фото в формате JPG, PNG или WebP.');
    if (file.size > MAX_FILE_SIZE) return onError('Фото слишком большое. Максимальный размер — 4 МБ.');
    const reader = new FileReader();
    reader.onerror = () => { if (readToken === readTokenRef.current) onError('Не удалось прочитать фото. Попробуйте другое.'); };
    reader.onload = () => {
      if (readToken !== readTokenRef.current) return;
      const source = String(reader.result ?? '');
      editTokenRef.current += 1;
      cropSourceRef.current = source;
      setCropRect(null);
      setCropSource(source);
      setActionsOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const applyCrop = async () => {
    const source = cropSource;
    const token = editTokenRef.current;
    setIsProcessing(true);
    try {
      const image = await loadImage(source);
      if (!source || cropSourceRef.current !== source || token !== editTokenRef.current) return;
      const preview = cropImageRef.current;
      if (!preview || !cropRect || preview.clientWidth <= 0 || preview.clientHeight <= 0) throw new Error('crop unavailable');
      const boundedSize = clamp(cropRect.size, Math.min(MIN_CROP_SIZE, preview.clientWidth, preview.clientHeight), Math.min(preview.clientWidth, preview.clientHeight));
      const boundedCrop = {
        x: clamp(cropRect.x, 0, preview.clientWidth - boundedSize),
        y: clamp(cropRect.y, 0, preview.clientHeight - boundedSize),
        size: boundedSize,
      };
      const canvas = document.createElement('canvas');
      const size = 512;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas unavailable');
      const scaleX = image.naturalWidth / preview.clientWidth;
      const scaleY = image.naturalHeight / preview.clientHeight;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, size, size);
      context.drawImage(image, boundedCrop.x * scaleX, boundedCrop.y * scaleY, boundedCrop.size * scaleX, boundedCrop.size * scaleY, 0, 0, size, size);
      onChange(canvas.toDataURL('image/jpeg', 0.86));
      cropSourceRef.current = '';
      setCropSource('');
      onError('');
    } catch {
      onError('Не удалось обработать фото. Попробуйте другое.');
      if (cropSourceRef.current === source) {
        cropSourceRef.current = '';
        setCropSource('');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const closeCrop = () => {
    readTokenRef.current += 1;
    editTokenRef.current += 1;
    cropSourceRef.current = '';
    cropGestureRef.current = null;
    setCropRect(null);
    setCropSource('');
  };

  const initializeCrop = () => {
    const image = cropImageRef.current;
    if (!image) return;
    const width = image.clientWidth;
    const height = image.clientHeight;
    const limit = Math.min(width, height);
    if (limit <= 0) return;
    const size = Math.min(limit, Math.max(Math.min(MIN_CROP_SIZE, limit), Math.round(limit * 0.72)));
    cropBoundsRef.current = { width, height };
    setCropRect({ x: Math.round((width - size) / 2), y: Math.round((height - size) / 2), size });
  };

  const rotateCropImage = async () => {
    const source = cropSource;
    const token = ++editTokenRef.current;
    setIsProcessing(true);
    try {
      const rotated = await rotateImage(source);
      if (token !== editTokenRef.current || cropSourceRef.current !== source) return;
      cropSourceRef.current = rotated;
      setCropRect(null);
      setCropSource(rotated);
    } catch {
      onError('Не удалось повернуть фото. Попробуйте другое.');
    } finally {
      if (token === editTokenRef.current) setIsProcessing(false);
    }
  };

  const startCropGesture = (event: PointerEvent<HTMLDivElement>) => {
    if (!cropRect || !cropImageRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    cropGestureRef.current = {
      mode: (event.target as HTMLElement).closest('[data-crop-resize]') ? 'resize' : 'move',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rect: cropRect,
      width: cropImageRef.current.clientWidth,
      height: cropImageRef.current.clientHeight,
    };
  };

  const moveCropGesture = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = cropGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (gesture.mode === 'move') {
      setCropRect({
        ...gesture.rect,
        x: clamp(gesture.rect.x + deltaX, 0, gesture.width - gesture.rect.size),
        y: clamp(gesture.rect.y + deltaY, 0, gesture.height - gesture.rect.size),
      });
      return;
    }
    const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    const maxSize = Math.min(gesture.width - gesture.rect.x, gesture.height - gesture.rect.y);
    setCropRect({ ...gesture.rect, size: clamp(gesture.rect.size + delta, Math.min(MIN_CROP_SIZE, maxSize), maxSize) });
  };

  const finishCropGesture = (event: PointerEvent<HTMLDivElement>) => {
    if (cropGestureRef.current?.pointerId === event.pointerId) cropGestureRef.current = null;
  };

  const moveCropWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!cropRect || !cropImageRef.current || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const step = 6;
    const width = cropImageRef.current.clientWidth;
    const height = cropImageRef.current.clientHeight;
    if (event.shiftKey) {
      const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? step : -step;
      const maxSize = Math.min(width - cropRect.x, height - cropRect.y);
      setCropRect({ ...cropRect, size: clamp(cropRect.size + delta, Math.min(MIN_CROP_SIZE, maxSize), maxSize) });
      return;
    }
    setCropRect({
      ...cropRect,
      x: clamp(cropRect.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), 0, width - cropRect.size),
      y: clamp(cropRect.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0), 0, height - cropRect.size),
    });
  };

  return (
    <>
      {variant === 'profile' ? (
        <IconButton variant="plain" className="profile-avatar-button" label={value ? 'Изменить фото профиля' : 'Добавить фото профиля'} icon={<><span className="profile-avatar-ring">{value ? <img src={value} alt="Фото профиля" /> : <BodyText as="strong" weight={500}>{emptyContent ?? <ImageIcon size={32} />}</BodyText>}</span><span className="profile-avatar-camera"><Camera size={15} /></span></>} onClick={() => value ? setActionsOpen(true) : inputRef.current?.click()} />
      ) : variant === 'settings' ? (
        <IconButton variant="plain" label={value ? 'Изменить фото профиля' : 'Добавить фото профиля'} icon={<><span className="profile-avatar-preview">{value ? <img src={value} alt="Новое фото профиля" /> : <UserRound size={32} />}</span><span><BodyText as="strong" weight={500}>Фото профиля</BodyText><DescriptionText as="small">Нажмите, чтобы изменить фотографию</DescriptionText></span><i><Camera size={20} /></i></>} onClick={() => value ? setActionsOpen(true) : inputRef.current?.click()} />
      ) : (
        <IconButton variant="plain" className="auth-avatar-button" label={value ? 'Изменить фото профиля' : 'Добавить фото профиля'} icon={<><span>{value ? <img src={value} alt="Фото профиля" /> : <ImageIcon size={32} />}</span><i><Camera size={18} /></i></>} onClick={() => value ? setActionsOpen(true) : inputRef.current?.click()} />
      )}
      <HiddenFileInput ref={inputRef} className="auth-avatar-input" accept="image/jpeg,image/png,image/webp" onChange={selectFile} />

      <ConfirmationDialog
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title="Фото профиля"
        description="Что вы хотите сделать?"
        icon={<ImageIcon />}
        tone="primary"
        singleAction
        className="profile-avatar-confirm-dialog"
        actions={(
          <div className="profile-avatar-confirm-actions">
            <Button size="sm" mode="solid" tone="primary" stretched startIcon={<ImageIcon />} onClick={() => inputRef.current?.click()}>Выбрать из галереи</Button>
            <div className="profile-avatar-confirm-actions__row">
              <Button size="sm" mode="outline" tone="neutral" stretched startIcon={<X />} onClick={() => setActionsOpen(false)}>Отмена</Button>
              <Button size="sm" mode="outline" tone="danger" stretched startIcon={<Trash2 />} disabled={!value} onClick={() => { onChange(''); setActionsOpen(false); }}>Удалить фото</Button>
            </div>
          </div>
        )}
      />

      <OverlaySurface open={Boolean(cropSource)} onClose={closeCrop} ariaLabel="Обрезать фото" closeOnBackdrop={false} layerClassName="auth-crop-layer" className="auth-crop-editor">
        <header>
          <IconButton label="Назад" size="sm" mode="ghost" tone="inverse" icon={<ArrowLeft />} onClick={closeCrop} />
          <IconButton label="Повернуть фото" size="sm" mode="ghost" tone="inverse" icon={<RotateCw />} disabled={isProcessing} onClick={() => void rotateCropImage()} />
          <Button size="sm" mode="ghost" tone="inverse" disabled={!cropRect || isProcessing} onClick={applyCrop}>ОБРЕЗАТЬ</Button>
        </header>
        <div className="auth-crop-stage">
          <div className="auth-crop-image-wrap">
            <img ref={cropImageRef} src={cropSource} alt="Предпросмотр обрезки" onLoad={initializeCrop} onError={() => { onError('Не удалось открыть фото. Выберите другое.'); closeCrop(); }} />
            {cropRect ? <div className="auth-crop-frame" role="group" aria-label="Область обрезки. Стрелки перемещают, Shift и стрелки меняют размер" tabIndex={0} style={{ left: cropRect.x, top: cropRect.y, width: cropRect.size, height: cropRect.size }} onPointerDown={startCropGesture} onPointerMove={moveCropGesture} onPointerUp={finishCropGesture} onPointerCancel={finishCropGesture} onKeyDown={moveCropWithKeyboard}><span aria-hidden="true" /><IconButton variant="plain" data-crop-resize label="Изменить размер области обрезки" icon={<span aria-hidden="true" />} /></div> : null}
          </div>
        </div>
      </OverlaySurface>
    </>
  );
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

async function rotateImage(source: string): Promise<string> {
  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalHeight;
  canvas.height = image.naturalWidth;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas unavailable');
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(Math.PI / 2);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
