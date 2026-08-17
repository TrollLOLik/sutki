import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { chatKeys } from '@/lib/api/chat';

export type ReportTargetType = 'user' | 'listing' | 'message' | 'review';
export type ReportReason =
  | 'spam'
  | 'fraud'
  | 'harassment'
  | 'inappropriate_content'
  | 'personal_data'
  | 'other';

export interface UserBlockState {
  blocked: boolean;
  blocked_by_me: boolean;
}

export interface BlockedUser {
  user_id: number;
  name: string;
  avatar_url?: string;
  blocked_at: string;
}

export interface BlockedUsersPage {
  items: BlockedUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateReportInput {
  target_type: ReportTargetType;
  target_id: number;
  reason: ReportReason;
  details?: string;
}

export interface ReportReceipt {
  id: number;
  target_type: ReportTargetType;
  target_id: number;
  reason: ReportReason;
  status: 'new' | string;
  created_at: string;
}

export const abuseKeys = {
  all: ['abuse'] as const,
  userBlockState: (userID: number) => [...abuseKeys.all, 'user-block-state', userID] as const,
  blockedUsers: () => [...abuseKeys.all, 'blocked-users'] as const,
};

export function createReport(input: CreateReportInput): Promise<ReportReceipt> {
  return api.post<ReportReceipt>('/api/v1/reports', {
    ...input,
    details: input.details?.trim() ?? '',
  });
}

export function useCreateReport() {
  return useMutation({ mutationFn: createReport });
}

export function fetchUserBlockState(userID: number): Promise<UserBlockState> {
  return api.get<UserBlockState>(`/api/v1/users/${userID}/block-state`);
}

export function useUserBlockState(userID: number | undefined, enabled = true) {
  return useQuery({
    queryKey: abuseKeys.userBlockState(userID ?? 0),
    queryFn: () => fetchUserBlockState(userID as number),
    enabled: enabled && userID != null && Number.isFinite(userID) && userID > 0,
    staleTime: 15_000,
  });
}

export function blockUser(userID: number): Promise<BlockedUser> {
  return api.post<BlockedUser>(`/api/v1/users/${userID}/block`);
}

export function unblockUser(userID: number): Promise<void> {
  return api.delete<void>(`/api/v1/users/${userID}/block`);
}

export function useBlockUser(userID: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => blockUser(userID),
    onSuccess: () => {
      queryClient.setQueryData<UserBlockState>(abuseKeys.userBlockState(userID), {
        blocked: true,
        blocked_by_me: true,
      });
      queryClient.invalidateQueries({ queryKey: abuseKeys.blockedUsers() });
      queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}

export function useUnblockUser(userID: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unblockUser(userID),
    onSuccess: () => {
      queryClient.setQueryData<UserBlockState>(abuseKeys.userBlockState(userID), {
        blocked: false,
        blocked_by_me: false,
      });
      queryClient.invalidateQueries({ queryKey: abuseKeys.blockedUsers() });
      queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}

export function useUnblockUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userID: number) => unblockUser(userID),
    onSuccess: (_data, userID) => {
      queryClient.setQueryData<UserBlockState>(abuseKeys.userBlockState(userID), {
        blocked: false,
        blocked_by_me: false,
      });
      queryClient.invalidateQueries({ queryKey: abuseKeys.blockedUsers() });
      queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}

export function fetchBlockedUsers(limit = 100, offset = 0): Promise<BlockedUsersPage> {
  return api.get<BlockedUsersPage>(`/api/v1/me/blocked-users?limit=${limit}&offset=${offset}`);
}

export function useBlockedUsers(enabled = true) {
  return useQuery({
    queryKey: abuseKeys.blockedUsers(),
    queryFn: () => fetchBlockedUsers(),
    enabled,
    staleTime: 15_000,
  });
}
