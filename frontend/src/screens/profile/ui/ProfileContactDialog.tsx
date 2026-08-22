import { LockKeyhole, Mail, Phone, ShieldCheck } from 'lucide-react';
import { BodyText, Button, DescriptionText, DialogActions, Field, Modal, OneTimeCodeField, PhoneField, TextField } from '@ui';
import { contactCodeLength, maskContact, type ContactChannel } from '../model/contactVerification';
import type { ContactTarget, ProfileDialog } from '../model/profileViewTypes';

interface ProfileContactDialogProps {
  open: boolean;
  visibleDialog: ProfileDialog;
  contactTarget: ContactTarget;
  verificationChannel: ContactChannel;
  verificationIdentifier: string;
  verificationSeconds: number;
  dialogValue: string;
  error: string;
  hasFallbackEmail: boolean;
  onClose: () => void;
  onBeginAccountVerification: () => void;
  onConfirmAccountVerification: () => void;
  onConfirmNewContact: () => void;
  onResetValue: () => void;
  onBeginNewContactVerification: () => void;
  onValueChange: (value: string) => void;
  onPhoneDigitsChange: (value: string) => void;
  onClearError: () => void;
  onResendVerificationCode: () => void;
  onUseEmailFallback: () => void;
}

export function ProfileContactDialog({ open, visibleDialog, contactTarget, verificationChannel, verificationIdentifier, verificationSeconds, dialogValue, error, hasFallbackEmail, onClose, onBeginAccountVerification, onConfirmAccountVerification, onConfirmNewContact, onResetValue, onBeginNewContactVerification, onValueChange, onPhoneDigitsChange, onClearError, onResendVerificationCode, onUseEmailFallback }: ProfileContactDialogProps) {
  const title = visibleDialog === 'contact-confirm'
    ? 'Подтвердите, что это вы'
    : visibleDialog === 'contact-verify'
      ? 'Введите код подтверждения'
      : visibleDialog === 'contact-input'
        ? (contactTarget === 'email' ? 'Новый адрес почты' : 'Новый номер телефона')
        : (contactTarget === 'email' ? 'Подтверждение новой почты' : 'Подтвердите новый номер');
  const description = visibleDialog === 'contact-confirm'
    ? `Сначала подтвердим аккаунт через ${verificationChannel === 'phone' ? 'текущий номер телефона' : 'текущую почту'}`
    : visibleDialog === 'contact-input'
      ? (contactTarget === 'email' ? 'Введите новый адрес электронной почты' : 'Введите новый номер телефона')
      : verificationChannel === 'phone'
        ? 'Введите последние 4 цифры номера входящего звонка'
        : 'Введите 6-значный код из письма';
  const footer = visibleDialog === 'contact-confirm' ? (
    <DialogActions primary={<Button size="md" mode="outline" tone="neutral" stretched onClick={onClose}>Закрыть</Button>} />
  ) : visibleDialog === 'contact-verify' || visibleDialog === 'contact-new-verify' ? (
    <DialogActions reset={<Button size="md" mode="outline" tone="neutral" stretched onClick={onResetValue}>Сбросить</Button>} primary={<Button size="md" mode="solid" tone="primary" stretched disabled={dialogValue.length !== contactCodeLength(verificationChannel)} onClick={visibleDialog === 'contact-verify' ? onConfirmAccountVerification : onConfirmNewContact}>Подтвердить</Button>} />
  ) : visibleDialog === 'contact-input' ? (
    <DialogActions reset={<Button size="md" mode="outline" tone="neutral" stretched onClick={onResetValue}>Сбросить</Button>} primary={<Button size="md" mode="solid" tone="primary" stretched onClick={onBeginNewContactVerification}>{contactTarget === 'phone' ? 'Получить звонок' : 'Получить код'}</Button>} />
  ) : undefined;

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} icon={visibleDialog === 'contact-input' ? (contactTarget === 'email' ? <Mail /> : <Phone />) : <ShieldCheck />} tone="primary" size="sm" layerClassName="profile-dialog-layer" className="profile-phone-confirm-dialog" footer={footer}>
      {visibleDialog === 'contact-confirm' ? (
        <>
          <div className="profile-phone-progress" aria-hidden="true"><i /><i /><i /></div>
          <div className="profile-email-intro">
            <BodyText as="p" color="secondary">Для смены данных необходимо подтвердить владение аккаунтом.</BodyText>
            <BodyText as="p" color="secondary">{verificationChannel === 'phone' ? 'Мы позвоним на подтверждённый номер телефона и покажем код.' : <>Отправим код на текущую почту:<br /><BodyText as="strong" weight={500} color="default">{maskContact('email', verificationIdentifier)}</BodyText></>}</BodyText>
            <Button size="lg" mode="solid" tone="primary" stretched onClick={onBeginAccountVerification}>{verificationChannel === 'phone' ? 'Получить звонок' : 'Отправить код'}</Button>
          </div>
        </>
      ) : visibleDialog === 'contact-verify' || visibleDialog === 'contact-new-verify' ? (
        <>
          <div className={`profile-phone-progress ${visibleDialog === 'contact-new-verify' ? 'is-complete' : ''}`} aria-hidden="true"><i /><i /><i /></div>
          <BodyText as="p" color="secondary" className="profile-email-step-copy">{visibleDialog === 'contact-new-verify' ? `Код отправлен на новый ${verificationChannel === 'phone' ? 'номер' : 'email'}` : `Код отправлен через ${verificationChannel === 'phone' ? 'звонок на номер' : 'почту'}`}<br /><BodyText as="strong" weight={500} color="default">{maskContact(verificationChannel, verificationIdentifier)}</BodyText></BodyText>
          <OneTimeCodeField autoFocus className={`profile-phone-code-field ${verificationChannel === 'email' ? 'profile-email-code-field' : ''}`} cellsClassName="profile-phone-code-cells" inputClassName="profile-phone-code-input" value={dialogValue} length={contactCodeLength(verificationChannel)} aria-label={verificationChannel === 'phone' ? 'Последние четыре цифры входящего номера' : 'Шестизначный код из письма'} onValueChange={onValueChange} />
          <Button className="profile-verification-resend" size="sm" mode="ghost" tone="neutral" disabled={verificationSeconds > 0} onClick={onResendVerificationCode}>{verificationSeconds > 0 ? `Отправить код повторно через 00:${String(verificationSeconds).padStart(2, '0')}` : 'Отправить код повторно'}</Button>
          {visibleDialog === 'contact-verify' && verificationChannel === 'phone' && hasFallbackEmail && verificationSeconds === 0 ? <Button size="lg" mode="soft" tone="primary" stretched startIcon={<Mail />} onClick={onUseEmailFallback}>Подтвердить по почте</Button> : null}
          {visibleDialog === 'contact-verify' ? <div className="profile-phone-legal-note"><LockKeyhole size={20} /><DescriptionText as="p" color="inherit">Сначала подтверждаем текущий контакт. Только после этого можно указать новые данные для входа.</DescriptionText></div> : null}
        </>
      ) : visibleDialog === 'contact-input' ? (
        <>
          <div className="profile-phone-progress is-second" aria-hidden="true"><i /><i /><i /></div>
          <Field error={error || undefined} messageId="profile-contact-error">
            {contactTarget === 'email' ? (
              <TextField id="profile-contact-field" size="lg" autoFocus type="email" autoComplete="email" aria-label="Новый адрес электронной почты" aria-describedby={error ? 'profile-contact-error' : undefined} invalid={Boolean(error)} before={<Mail size={19} />} value={dialogValue} onChange={(event) => { onValueChange(event.target.value); onClearError(); }} placeholder="new-email@example.com" />
            ) : (
              <PhoneField id="profile-contact-field" size="lg" autoFocus className="profile-contact-phone-input" aria-label="Новый номер телефона" aria-describedby={error ? 'profile-contact-error' : undefined} invalid={Boolean(error)} value={dialogValue.replace(/^\+7\s?/, '')} onChange={(event) => { onPhoneDigitsChange(event.target.value); onClearError(); }} />
            )}
          </Field>
        </>
      ) : null}
    </Modal>
  );
}
