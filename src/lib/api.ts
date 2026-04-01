const AUTH_URL = "https://functions.poehali.dev/dca07f1d-d78a-4aab-84d8-6a030d725e06";
const CHANNELS_URL = "https://functions.poehali.dev/7b4cba6b-706a-4641-aab4-fd4dac66d0f6";
const MESSAGES_URL = "https://functions.poehali.dev/f868bcb5-47cf-457b-a36e-20f5b3ba0dd1";

function getToken(): string | null {
  return localStorage.getItem("epicgram_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers as Record<string, string> || {}) },
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// Auth API
export const authApi = {
  sendCode: (phone: string) =>
    apiFetch(`${AUTH_URL}/auth/send-code`, {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),

  verifyCode: (phone: string, code: string, first_name?: string, last_name?: string) =>
    apiFetch(`${AUTH_URL}/auth/verify-code`, {
      method: "POST",
      body: JSON.stringify({ phone, code, first_name, last_name }),
    }),

  getMe: () =>
    apiFetch(`${AUTH_URL}/auth/me`),

  updateProfile: (data: { first_name: string; last_name: string; username: string; bio: string }) =>
    apiFetch(`${AUTH_URL}/auth/update-profile`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// Channels API
export const channelsApi = {
  getAll: () =>
    apiFetch(`${CHANNELS_URL}/channels`),

  getMy: () =>
    apiFetch(`${CHANNELS_URL}/channels/my`),

  getPosts: (channelId: number) =>
    apiFetch(`${CHANNELS_URL}/channels/${channelId}/posts`),

  subscribe: (channelId: number) =>
    apiFetch(`${CHANNELS_URL}/channels/${channelId}/subscribe`, { method: "POST" }),

  create: (data: { name: string; username: string; description: string }) =>
    apiFetch(`${CHANNELS_URL}/channels/create`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  post: (channelId: number, text: string) =>
    apiFetch(`${CHANNELS_URL}/channels/${channelId}/post`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
};

// Messages API
export const messagesApi = {
  getChats: () =>
    apiFetch(`${MESSAGES_URL}/messages/chats`),

  getMessages: (chatId: number) =>
    apiFetch(`${MESSAGES_URL}/messages/${chatId}`),

  sendMessage: (chatId: number, text: string) =>
    apiFetch(`${MESSAGES_URL}/messages/${chatId}/send`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  createChat: (userId: number) =>
    apiFetch(`${MESSAGES_URL}/messages/create-chat`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    }),
};

export type User = {
  id: number;
  phone: string;
  username: string | null;
  first_name: string;
  last_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean;
};

export type Channel = {
  id: number;
  name: string;
  username: string | null;
  description: string | null;
  avatar_url: string | null;
  subscribers_count: number;
  created_at: string;
  is_subscribed?: boolean;
  last_post?: string;
  last_post_at?: string;
};

export type Post = {
  id: number;
  text: string;
  media_url: string | null;
  views_count: number;
  created_at: string;
  author: { first_name: string; last_name: string; username: string };
};

export type Message = {
  id: number;
  text: string;
  created_at: string;
  sender_id: number;
  is_mine: boolean;
  is_edited: boolean;
  sender: { first_name: string; last_name: string; username: string };
};

export type Chat = {
  id: number;
  type: string;
  name: string;
  avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  other_user_id: number | null;
};
