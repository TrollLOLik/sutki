import { create } from 'zustand';
import { Centrifuge } from 'centrifuge';
import { env } from '@/lib/env';
import { api } from '@/lib/api/client';
import { queryClient } from '@/lib/query';

interface ChatMessage {
	id: number;
	conversation_id: number;
	sender_id: number;
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

			// Invalidate conversation list cache on reconnect to synchronize unread counts
			queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
		});

		centrifuge.on('disconnected', () => {
			console.log('[Chat] Socket disconnected');
			set({ status: 'disconnected' });
		});

		// Listen to server-side publications (like personal user#<id> channel events)
		centrifuge.on('publication', (ctx) => {
			console.log('[Chat] Received server publication on channel:', ctx.channel, ctx.data);
			const payload = ctx.data as { type: string; conversation_id?: number; unread_count?: number };
			if (payload.type === 'unread_update') {
				queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
			}
		});

		centrifuge.connect();
		set({ centrifuge });
	},

	disconnect: () => {
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
export type { ChatMessage };
