import { create } from 'zustand';
import { Centrifuge } from 'centrifuge';
import { env } from '@/lib/env';
import { api } from '@/lib/api/client';
import { queryClient } from '@/lib/query';

/** Machine-readable payload of a booking_status system message. */
interface BookingStatusPayload {
	request_id: number;
	event: 'new' | 'confirmed' | 'rejected' | 'cancelled';
	start_date?: string;
	end_date?: string;
	guests?: number;
	reason?: string;
	address?: string;
}

interface ChatMessage {
	id: number;
	conversation_id: number;
	/** null for system messages (booking status cards) */
	sender_id: number | null;
	/** 'user' (default) or 'booking_status'; older cache entries may omit it */
	kind?: string;
	payload?: BookingStatusPayload;
	body?: string;
	created_at: string;
	attachments?: Array<{
		id: number;
		message_id: number;
		url: string;
		file_name: string;
		mime_type: string;
		size_bytes: number;
		width?: number;
		height?: number;
	}>;
	pending?: boolean;
	failed?: boolean;
}

interface ChatState {
	centrifuge: Centrifuge | null;
	status: 'disconnected' | 'connecting' | 'connected';
	activeConversationId: number | null;
	init: (accessToken: string) => void;
	disconnect: () => void;
	setActiveConversationId: (id: number | null) => void;
}

interface UserRealtimeEvent {
	type: string;
	scope?: string;
	action?: string;
	entity_id?: number;
	conversation_id?: number;
}

const PRESENCE_HEARTBEAT_INTERVAL_MS = 45_000;
let presenceHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

function stopPresenceHeartbeat() {
	if (presenceHeartbeatTimer) {
		clearInterval(presenceHeartbeatTimer);
		presenceHeartbeatTimer = null;
	}
}

function startPresenceHeartbeat() {
	stopPresenceHeartbeat();
	const heartbeat = () => {
		api.post<void>('/api/v1/chat/presence/heartbeat').catch((error) => {
			console.warn('[Chat] Presence heartbeat failed:', error);
		});
	};
	heartbeat();
	presenceHeartbeatTimer = setInterval(heartbeat, PRESENCE_HEARTBEAT_INTERVAL_MS);
}

function invalidateRealtimeData(payload?: UserRealtimeEvent) {
	queryClient.invalidateQueries({ queryKey: ['activity'] });
	if (!payload) {
		for (const key of [['chat'], ['bookings'], ['listings'], ['my-listings'], ['reviews'], ['my-reviews'], ['listing-promotions']]) {
			queryClient.invalidateQueries({ queryKey: key });
		}
		return;
	}
	switch (payload.type) {
		case 'unread_update':
		case 'message.changed':
			queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
			break;
		case 'booking.changed':
			queryClient.invalidateQueries({ queryKey: ['bookings'] });
			queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
			break;
		case 'listing.changed':
			queryClient.invalidateQueries({ queryKey: ['listings'] });
			queryClient.invalidateQueries({ queryKey: ['my-listings'] });
			queryClient.invalidateQueries({ queryKey: ['favorites'] });
			queryClient.invalidateQueries({ queryKey: ['listing-promotions'] });
			break;
		case 'review.changed':
			queryClient.invalidateQueries({ queryKey: ['reviews'] });
			queryClient.invalidateQueries({ queryKey: ['my-reviews'] });
			queryClient.invalidateQueries({ queryKey: ['host-reviews'] });
			queryClient.invalidateQueries({ queryKey: ['listings'] });
			break;
	}
}

export const useChatStore = create<ChatState>((set, get) => ({
	centrifuge: null,
	status: 'disconnected',
	activeConversationId: null,

	init: (accessToken: string) => {
		const current = get().centrifuge;
		if (current) {
			current.disconnect();
		}

		console.log('[Chat] Initializing Centrifuge socket client to:', env.wsUrl);

		const centrifuge = new Centrifuge(env.wsUrl, {
			getToken: async () => {
				try {
					console.log('[Chat] Fetching connection token...');
					const res = await api.get<{ connection_token: string }>('/api/v1/chat/ws-tokens');
					return res.connection_token;
				} catch (err) {
					console.error('[Chat] Failed to fetch Centrifugo connection token:', err);
					throw err;
				}
			},
		});

		centrifuge.on('connecting', () => {
			console.log('[Chat] Socket connecting...');
			set({ status: 'connecting' });
		});

		centrifuge.on('connected', () => {
			console.log('[Chat] Socket connected successfully! ✅');
			set({ status: 'connected' });
			startPresenceHeartbeat();

			// Invalidate conversation list cache on reconnect to synchronize unread counts
			invalidateRealtimeData();
		});

		centrifuge.on('disconnected', () => {
			console.log('[Chat] Socket disconnected');
			stopPresenceHeartbeat();
			set({ status: 'disconnected' });
		});

		// Listen to server-side publications (like personal user#<id> channel events)
		centrifuge.on('publication', (ctx) => {
			console.log('[Chat] Received server publication on channel:', ctx.channel, ctx.data);
			invalidateRealtimeData(ctx.data as UserRealtimeEvent);
		});

		centrifuge.connect();
		set({ centrifuge });
	},

	disconnect: () => {
		stopPresenceHeartbeat();
		const current = get().centrifuge;
		if (current) {
			console.log('[Chat] Disconnecting Centrifuge client');
			current.disconnect();
		}
		set({ centrifuge: null, status: 'disconnected', activeConversationId: null });
	},

	setActiveConversationId: (id: number | null) => {
		set({ activeConversationId: id });
	},
}));
export type { ChatMessage, BookingStatusPayload };
