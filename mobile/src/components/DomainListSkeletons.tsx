import { StyleSheet, View } from 'react-native';

import { MaterialSurface, Skeleton } from '@/components/ui';

export function BookingListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, index) => (
        <MaterialSurface key={index} level="raised" radius={24} style={styles.bookingCard}>
          <View style={styles.bookingTop}>
            <Skeleton width={116} height={28} radius={14} />
            <Skeleton width={36} height={12} radius={4} />
          </View>
          <View style={styles.bookingBody}>
            <Skeleton width={88} height={88} radius={17} />
            <View style={styles.flexCopy}>
              <Skeleton width="74%" height={19} radius={5} />
              <Skeleton width="48%" height={14} radius={4} />
              <Skeleton width="84%" height={13} radius={4} />
              <Skeleton width="44%" height={13} radius={4} />
            </View>
          </View>
          <View style={styles.bookingTotal}>
            <Skeleton width="36%" height={13} radius={4} />
            <Skeleton width={96} height={21} radius={5} />
          </View>
          <View style={styles.bookingAction}>
            <Skeleton width="100%" height={44} radius={16} />
          </View>
        </MaterialSurface>
      ))}
    </View>
  );
}

export function ReviewListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, index) => (
        <MaterialSurface key={index} level="raised" radius={20} style={styles.reviewCard}>
          <View style={styles.reviewHead}>
            <Skeleton width={44} height={44} radius={22} />
            <View style={styles.flexCopy}>
              <Skeleton width="48%" height={16} radius={5} />
              <Skeleton width="30%" height={12} radius={4} />
            </View>
          </View>
          <Skeleton width={124} height={28} radius={14} />
          <Skeleton width="96%" height={15} radius={4} />
          <Skeleton width="72%" height={15} radius={4} />
        </MaterialSurface>
      ))}
    </View>
  );
}

export function NotificationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, index) => (
        <MaterialSurface key={index} level="raised" radius={20} style={styles.notificationCard}>
          <Skeleton width={44} height={44} radius={15} />
          <View style={styles.flexCopy}>
            <Skeleton width="46%" height={17} radius={5} />
            <Skeleton width="94%" height={13} radius={4} style={styles.skeletonGap} />
            <Skeleton width="66%" height={13} radius={4} style={styles.skeletonGap} />
            <Skeleton width={72} height={11} radius={4} style={styles.skeletonGap} />
          </View>
        </MaterialSurface>
      ))}
    </View>
  );
}

export function ConversationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.conversationList}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.conversationRow}>
          <Skeleton width={58} height={58} radius={29} />
          <View style={styles.conversationCopy}>
            <View style={styles.bookingTop}>
              <Skeleton width="54%" height={18} radius={5} />
              <Skeleton width={42} height={11} radius={4} />
            </View>
            <Skeleton width="68%" height={11} radius={4} style={styles.skeletonGap} />
            <Skeleton width="84%" height={14} radius={4} style={styles.skeletonGap} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 },
  bookingCard: { marginBottom: 12, overflow: 'hidden', paddingHorizontal: 20, paddingTop: 17 },
  bookingTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  bookingBody: { marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bookingTotal: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bookingAction: { marginHorizontal: -20, marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.18)', paddingHorizontal: 16, paddingTop: 14 },
  flexCopy: { flex: 1, minWidth: 0, gap: 6 },
  reviewCard: { marginBottom: 12, gap: 13, padding: 16 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notificationCard: { marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 15 },
  skeletonGap: { marginTop: 2 },
  conversationList: { paddingTop: 2, paddingBottom: 110 },
  conversationRow: { minHeight: 90, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18 },
  conversationCopy: { flex: 1, minWidth: 0, paddingVertical: 14 },
});
