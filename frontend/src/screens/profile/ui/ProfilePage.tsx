import { DesktopTopbar } from '@widgets/app-navigation';
import { useProfileController } from '../model/useProfileController';
import { ProfileHeader } from './ProfileHeader';
import { ProfileOverview } from './ProfileOverview';
import { ProfileSettingsFlow } from './ProfileSettingsFlow';


export function ProfilePage({
  onHome,
  onCreate,
  onMap,
  onMessages,
  onBookings,
  onFavorites,
  onIncoming,
  onMyListings,
  onReviews,
  onNotifications,
  onSignOut,
  onToast,
  onTabBarHiddenChange,
}: {
  onHome: () => void;
  onCreate: () => void;
  onMap: () => void;
  onMessages: () => void;
  onBookings: () => void;
  onFavorites: () => void;
  onIncoming: () => void;
  onMyListings: () => void;
  onReviews: () => void;
  onNotifications: () => void;
  onSignOut: () => void;
  onToast: (message: string) => void;
  onTabBarHiddenChange: (hidden: boolean) => void;
}) {
  const controller = useProfileController({
    onBookings,
    onFavorites,
    onIncoming,
    onMyListings,
    onReviews,
    onNotifications,
    onSignOut,
    onToast,
    onTabBarHiddenChange,
  });
  const {
    profile,
    setSignOutOpen,
    avatarError,
    setAvatarError,
    completion,
    myListings,
    actionGroups,
    openSettings,
    changeTheme,
    updateProfileAvatar,
    copySupportAddress,
  } = controller;

  return (
    <div className="profile-screen">
      <DesktopTopbar active="profile" onSearch={onHome} onMap={onMap} onMessages={onMessages} onProfile={() => undefined} onCreate={onCreate} />

      <ProfileHeader presentation="mobile" onBack={onHome} onSettings={() => openSettings('basic')} />

      <main className="profile-content">
        <ProfileHeader presentation="desktop" onBack={onHome} onSettings={() => openSettings('basic')} />
        <ProfileOverview
          profile={profile}
          listingsCount={myListings.length}
          completion={completion}
          avatarError={avatarError}
          actionGroups={actionGroups}
          onAvatarChange={updateProfileAvatar}
          onAvatarError={setAvatarError}
          onOpenSettings={openSettings}
          onThemeChange={changeTheme}
          onCopySupport={() => void copySupportAddress()}
          onRequestSignOut={() => setSignOutOpen(true)}
        />
      </main>

      <ProfileSettingsFlow controller={controller} />
    </div>
  );
}
