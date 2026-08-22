export {
  demoSession,
  maskAuthIdentifier,
  useDemoSession,
  type AuthChannel,
  type DemoSession,
  type DemoSessionStatus,
  type DemoProfileSetup,
} from './model/sessionStore';
export { normalizeAuthEmail } from './model/authEmail';
export {
  loadWebSession,
  logoutWebSession,
  requestEmailCode,
  requestPhoneCode,
  requestPhoneVoiceFallback,
  saveProfileSetup,
  uploadProfileAvatar,
  verifyEmailCode,
  verifyPhoneCode,
  WebAuthError,
} from './api/webAuth';
export {
  clearPendingChallenge,
  createPendingChallenge,
  getPendingChallenge,
  type PendingAuthChallenge,
} from './model/webAuthFlow';
export type {
  ProfileSetupPayload,
  MediaUploadTarget,
  RequestCodeResponse,
  VerifyCodeResponse,
  WebAuthUser,
  WebSessionResponse,
} from './model/webAuthTypes';
