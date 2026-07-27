import { create } from 'zustand';

/**
 * Tracks whether the backend has declared this build too old to talk to.
 *
 * The API answers 426 Upgrade Required to any request from a build below
 * MIN_APP_VERSION. Without this, that 426 would surface as a generic error on
 * whatever form the user happened to be on — they would see "что-то пошло не
 * так" on the login screen and have no way to learn an update exists. The api
 * client flips this flag on any 426 and the root layout renders a blocking
 * screen over the whole app.
 *
 * Deliberately one-way: once the server has said this build is unsupported,
 * nothing in the session can make it supported again.
 */
interface AppVersionState {
  upgradeRequired: boolean;
  minimumSupportedVersion: string | null;
  requireUpgrade: (minimumSupportedVersion?: string | null) => void;
}

export const useAppVersionStore = create<AppVersionState>((set) => ({
  upgradeRequired: false,
  minimumSupportedVersion: null,
  requireUpgrade: (minimumSupportedVersion) =>
    set((state) => ({
      upgradeRequired: true,
      minimumSupportedVersion: minimumSupportedVersion ?? state.minimumSupportedVersion,
    })),
}));
