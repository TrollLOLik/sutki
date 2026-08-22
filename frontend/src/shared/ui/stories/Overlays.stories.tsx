import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleAlert } from 'lucide-react';
import { BottomSheet, Button, ConfirmationDialog, DialogHeader, Field, Modal, OverlaySurface, TextArea } from '..';

function OverlaysGallery() {
  const [modal, setModal] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [surface, setSurface] = useState(false);
  const [confirmation, setConfirmation] = useState(false);

  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
    <div style={{ width: '100%', overflow: 'hidden', border: '1px solid var(--line)', borderRadius: 18 }}><DialogHeader title="Общий заголовок окна" description="Иконка, заголовок и крестик всегда стоят одинаково" icon={<CircleAlert />} onClose={() => undefined} /></div>
    <Button onClick={() => setModal(true)}>Открыть окно</Button>
    <Button variant="secondary" onClick={() => setSheet(true)}>Открыть панель</Button>
    <Button variant="tertiary" onClick={() => setSurface(true)}>Открыть поверхность</Button>
    <Button variant="danger" onClick={() => setConfirmation(true)}>Открыть подтверждение</Button>

    <ConfirmationDialog
      open={confirmation}
      onClose={() => setConfirmation(false)}
      title="Удалить сообщение?"
      description="Оно исчезнет у вас и у собеседника."
      icon={<CircleAlert size={20} />}
      tone="danger"
      actions={<><Button variant="secondary" onClick={() => setConfirmation(false)}>Отмена</Button><Button variant="danger" onClick={() => setConfirmation(false)}>Удалить</Button></>}
    />

    <Modal
      open={modal}
      title="Подтвердить бронирование?"
      description="Гость получит уведомление"
      onClose={() => setModal(false)}
      footer={<><Button variant="secondary" onClick={() => setModal(false)}>Отмена</Button><Button onClick={() => setModal(false)}>Подтвердить</Button></>}
    >
      <p style={{ margin: 0, color: 'var(--ink-secondary)' }}>14-18 августа · 4 ночи · 2 гостя</p>
    </Modal>

    <BottomSheet
      open={sheet}
      title="Отклонить заявку"
      subtitle="Причина поможет гостю понять решение"
      onClose={() => setSheet(false)}
      footer={<><Button variant="secondary" onClick={() => setSheet(false)}>Назад</Button><Button variant="danger" onClick={() => setSheet(false)}>Отклонить</Button></>}
    >
      <Field label="Причина"><TextArea placeholder="Например, даты уже заняты" /></Field>
    </BottomSheet>

    <OverlaySurface
      open={surface}
      onClose={() => setSurface(false)}
      ariaLabel="Пример свободной поверхности"
      layerClassName="ui-overlay"
      className="ui-modal ui-modal--sm"
    >
      <div className="ui-modal__body"><Button onClick={() => setSurface(false)}>Закрыть</Button></div>
    </OverlaySurface>
  </div>;
}

const meta = { title: 'UI Kit/Overlays', component: OverlaysGallery, tags: ['autodocs'] } satisfies Meta<typeof OverlaysGallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ModalSheetAndSurface: Story = {};
