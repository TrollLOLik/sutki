import { Download, FileText, Video } from 'lucide-react';
import type { ChatAttachment } from '@features/chat';
import { BadgeText, BodyText, Pressable, PressableLink, SectionTitle } from '@ui';

interface MessageAttachmentsProps {
  attachments: ChatAttachment[];
  onOpenImage: (attachmentId: string) => void;
}

export function MessageAttachments({ attachments, onOpenImage }: MessageAttachmentsProps) {
  const images = attachments.filter((item) => item.kind === 'image');
  const rest = attachments.filter((item) => item.kind !== 'image');

  return (
    <div className="chat-attachments">
      {images.length ? (
        <div className={`chat-image-grid count-${Math.min(images.length, 4)}`}>
          {images.slice(0, 4).map((item, index) => (
            <Pressable key={item.id} aria-label={`Открыть ${item.name}`} onClick={() => onOpenImage(item.id)}>
              <img src={item.url} alt={item.name} />
              {index === 3 && images.length > 4 ? <SectionTitle color="inverse">+{images.length - 4}</SectionTitle> : null}
            </Pressable>
          ))}
        </div>
      ) : null}
      {rest.map((item) => (
        <PressableLink key={item.id} className="chat-file-attachment" href={item.url} target="_blank" rel="noreferrer" download={item.name}>
          <span>{item.kind === 'video' ? <Video size={21} /> : <FileText size={21} />}</span>
          <div><BodyText as="strong" weight={500} color="inherit" truncate>{item.name}</BodyText><BadgeText as="small" weight={400} color="inherit">{item.sizeLabel || (item.kind === 'video' ? 'Видео' : 'Файл')}</BadgeText></div>
          <i aria-hidden="true"><Download size={18} /></i>
        </PressableLink>
      ))}
    </div>
  );
}
