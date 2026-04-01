import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { channelsApi, messagesApi, Channel, Post, Message, Chat } from "@/lib/api";

type View = "chats" | "channels" | "explore";
type ActiveChat = { type: "chat"; chat: Chat } | { type: "channel"; channel: Channel } | null;

// Аватар с инициалами
function Avatar({ name, size = 40, color }: { name: string; size?: number; color?: string }) {
  const colors = [
    "#2ea6ff", "#f39c12", "#e74c3c", "#9b59b6",
    "#1abc9c", "#e67e22", "#3498db", "#27ae60",
  ];
  const bg = color || colors[Math.abs(name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % colors.length];
  const initial = name ? name[0].toUpperCase() : "?";
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}

// Форматирование числа подписчиков
function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

// Форматирование времени
function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин`;
  if (hours < 24) return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
  if (days < 7) return d.toLocaleDateString("ru", { weekday: "short" });
  return d.toLocaleDateString("ru", { day: "2-digit", month: "2-digit" });
}

export default function Main() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>("chats");
  const [activeChat, setActiveChat] = useState<ActiveChat>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Чаты
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);

  // Каналы
  const [myChannels, setMyChannels] = useState<Channel[]>([]);
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);

  // Сообщения
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Посты канала
  const [channelPosts, setChannelPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [showPostInput, setShowPostInput] = useState(false);

  // Создать канал
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    loadChats();
    loadMyChannels();
    loadAllChannels();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const loadChats = async () => {
    setChatsLoading(true);
    try {
      const { ok, data } = await messagesApi.getChats();
      if (ok) setChats(data.chats || []);
    } finally {
      setChatsLoading(false);
    }
  };

  const loadMyChannels = async () => {
    try {
      const { ok, data } = await channelsApi.getMy();
      if (ok) setMyChannels(data.channels || []);
    } catch (_e) {
      // ignore
    }
  };

  const loadAllChannels = async () => {
    setChannelsLoading(true);
    try {
      const { ok, data } = await channelsApi.getAll();
      if (ok) setAllChannels(data.channels || []);
    } finally {
      setChannelsLoading(false);
    }
  };

  const openChat = async (chat: Chat) => {
    setActiveChat({ type: "chat", chat });
    if (isMobile) setShowSidebar(false);
    setMessagesLoading(true);
    try {
      const { ok, data } = await messagesApi.getMessages(chat.id);
      if (ok) setMessages(data.messages || []);
    } finally {
      setMessagesLoading(false);
    }
  };

  const openChannel = async (channel: Channel) => {
    setActiveChat({ type: "channel", channel });
    if (isMobile) setShowSidebar(false);
    setPostsLoading(true);
    try {
      const { ok, data } = await channelsApi.getPosts(channel.id);
      if (ok) setChannelPosts(data.posts || []);
    } finally {
      setPostsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || activeChat?.type !== "chat") return;
    const text = newMessage.trim();
    setNewMessage("");
    const { ok, data } = await messagesApi.sendMessage(activeChat.chat.id, text);
    if (ok) {
      setMessages((prev) => [...prev, data.message]);
    }
  };

  const sendPost = async () => {
    if (!newPost.trim() || activeChat?.type !== "channel") return;
    const text = newPost.trim();
    setNewPost("");
    setShowPostInput(false);
    const { ok, data } = await channelsApi.post(activeChat.channel.id, text);
    if (ok) {
      setChannelPosts((prev) => [data.post, ...prev]);
    }
  };

  const handleSubscribe = async (channelId: number) => {
    const { ok } = await channelsApi.subscribe(channelId);
    if (ok) {
      loadMyChannels();
      loadAllChannels();
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    setCreating(true);
    const { ok, data } = await channelsApi.create({
      name: newChannelName,
      username: "",
      description: newChannelDesc,
    });
    if (ok) {
      setShowCreateChannel(false);
      setNewChannelName("");
      setNewChannelDesc("");
      loadMyChannels();
      loadAllChannels();
      openChannel(data.channel);
    }
    setCreating(false);
  };

  const filteredChats = chats.filter((c) =>
    (c.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMyChannels = myChannels.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAllChannels = allChannels.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ")
    : "Пользователь";

  return (
    <div className="h-screen bg-[#17212b] flex overflow-hidden">
      {/* Sidebar */}
      {(showSidebar || !isMobile) && (
        <div className={`${isMobile ? "absolute inset-0 z-50" : "w-[360px]"} bg-[#17212b] flex flex-col border-r border-[#0d1923]`}>
          {/* Header */}
          <div className="h-14 flex items-center px-4 gap-3 bg-[#17212b]">
            {showSettings ? (
              <>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 flex items-center justify-center text-[#708fa0] hover:text-white transition-colors"
                >
                  ←
                </button>
                <span className="text-white font-semibold">Настройки</span>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowSettings(true)}
                  className="w-9 h-9 flex-shrink-0"
                >
                  <Avatar name={displayName} size={36} color="#2ea6ff" />
                </button>
                <div className="flex-1 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#708fa0]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск"
                    className="w-full bg-[#253344] rounded-xl pl-9 pr-3 py-2 text-white placeholder-[#708fa0] text-sm focus:outline-none focus:bg-[#2b3c4e] transition-colors"
                  />
                </div>
                <button
                  onClick={() => setShowCreateChannel(true)}
                  className="w-8 h-8 flex items-center justify-center text-[#708fa0] hover:text-white transition-colors"
                  title="Создать канал"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Settings Panel */}
          {showSettings ? (
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 text-center border-b border-[#253344]">
                <Avatar name={displayName} size={80} color="#2ea6ff" />
                <h2 className="text-white text-xl font-bold mt-3">{displayName}</h2>
                <p className="text-[#708fa0] text-sm">{user?.phone}</p>
                {user?.username && (
                  <p className="text-[#2ea6ff] text-sm">@{user.username}</p>
                )}
              </div>
              <div className="p-2">
                {[
                  { icon: "👤", label: "Мой профиль" },
                  { icon: "🔔", label: "Уведомления" },
                  { icon: "🔒", label: "Конфиденциальность" },
                  { icon: "🎨", label: "Оформление" },
                  { icon: "❓", label: "Помощь" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-[#253344] cursor-pointer transition-colors"
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-white text-sm">{item.label}</span>
                  </div>
                ))}
                <div
                  onClick={logout}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-[#253344] cursor-pointer transition-colors"
                >
                  <span className="text-xl">🚪</span>
                  <span className="text-[#ff6b6b] text-sm">Выйти</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b border-[#0d1923]">
                {[
                  { id: "chats" as View, label: "Чаты" },
                  { id: "channels" as View, label: "Каналы" },
                  { id: "explore" as View, label: "Обзор" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setView(tab.id)}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                      view === tab.id
                        ? "text-[#2ea6ff] border-b-2 border-[#2ea6ff]"
                        : "text-[#708fa0] hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Chat list */}
              <div className="flex-1 overflow-y-auto">
                {view === "chats" && (
                  <>
                    {chatsLoading ? (
                      <div className="p-4 text-center text-[#708fa0]">Загрузка...</div>
                    ) : filteredChats.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="text-5xl mb-3">💬</div>
                        <p className="text-white font-medium mb-1">Нет чатов</p>
                        <p className="text-[#708fa0] text-sm">Начните переписку</p>
                      </div>
                    ) : (
                      filteredChats.map((chat) => (
                        <ChatItem
                          key={chat.id}
                          name={chat.name || "Чат"}
                          lastMessage={chat.last_message}
                          time={formatTime(chat.last_message_at)}
                          isActive={activeChat?.type === "chat" && activeChat.chat.id === chat.id}
                          onClick={() => openChat(chat)}
                        />
                      ))
                    )}
                  </>
                )}

                {view === "channels" && (
                  <>
                    <div className="px-4 py-2 text-[#708fa0] text-xs font-semibold uppercase tracking-wider">
                      Мои каналы
                    </div>
                    {filteredMyChannels.length === 0 ? (
                      <div className="px-4 py-3 text-[#708fa0] text-sm">
                        Нет подписок. Найдите каналы во вкладке «Обзор»
                      </div>
                    ) : (
                      filteredMyChannels.map((channel) => (
                        <ChannelItem
                          key={channel.id}
                          channel={channel}
                          isActive={activeChat?.type === "channel" && activeChat.channel.id === channel.id}
                          onClick={() => openChannel(channel)}
                        />
                      ))
                    )}
                  </>
                )}

                {view === "explore" && (
                  <>
                    <div className="px-4 py-2 text-[#708fa0] text-xs font-semibold uppercase tracking-wider">
                      Популярные каналы
                    </div>
                    {channelsLoading ? (
                      <div className="p-4 text-center text-[#708fa0]">Загрузка...</div>
                    ) : (
                      filteredAllChannels.map((channel) => (
                        <div key={channel.id} className="px-4 py-3 border-b border-[#1c2c3a] flex items-center gap-3">
                          <div
                            className="cursor-pointer"
                            onClick={() => openChannel(channel)}
                          >
                            <Avatar name={channel.name} size={48} />
                          </div>
                          <div className="flex-1 min-w-0" onClick={() => openChannel(channel)} style={{ cursor: "pointer" }}>
                            <div className="flex items-center gap-1">
                              <span className="text-white font-medium text-sm truncate">{channel.name}</span>
                              <svg className="w-3.5 h-3.5 text-[#2ea6ff] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <p className="text-[#708fa0] text-xs truncate">{channel.description}</p>
                            <p className="text-[#708fa0] text-xs">{formatCount(channel.subscribers_count)} подписчиков</p>
                          </div>
                          <button
                            onClick={() => handleSubscribe(channel.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
                              channel.is_subscribed
                                ? "bg-[#253344] text-[#708fa0]"
                                : "bg-[#2ea6ff] text-white hover:bg-[#1a8de0]"
                            }`}
                          >
                            {channel.is_subscribed ? "Подписан" : "Подписаться"}
                          </button>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {!activeChat ? (
          <div className="flex-1 flex items-center justify-center bg-[#0d1923]">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#2ea6ff] to-[#1a73e8] flex items-center justify-center">
                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                </svg>
              </div>
              <h2 className="text-white text-2xl font-bold mb-2">Epicgram</h2>
              <p className="text-[#708fa0] text-sm max-w-xs">
                Выберите чат или канал из списка слева, чтобы начать общение
              </p>
            </div>
          </div>
        ) : activeChat.type === "chat" ? (
          // Chat View
          <>
            <div className="h-14 bg-[#17212b] border-b border-[#0d1923] flex items-center px-4 gap-3">
              {isMobile && (
                <button
                  onClick={() => setShowSidebar(true)}
                  className="text-[#708fa0] hover:text-white mr-1"
                >
                  ←
                </button>
              )}
              <Avatar name={activeChat.chat.name || "?"} size={36} />
              <div>
                <p className="text-white font-semibold text-sm">{activeChat.chat.name || "Чат"}</p>
                <p className="text-[#708fa0] text-xs">в сети</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button className="w-8 h-8 flex items-center justify-center text-[#708fa0] hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#0d1923]" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #1a2a3a 1px, transparent 0)", backgroundSize: "40px 40px" }}>
              {messagesLoading ? (
                <div className="text-center text-[#708fa0] mt-8">Загрузка...</div>
              ) : messages.length === 0 ? (
                <div className="text-center mt-8">
                  <div className="text-4xl mb-2">👋</div>
                  <p className="text-[#708fa0] text-sm">Начните разговор!</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-[#17212b] border-t border-[#0d1923]">
              <div className="flex items-end gap-2">
                <button className="w-9 h-9 flex items-center justify-center text-[#708fa0] hover:text-white flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                <div className="flex-1 bg-[#253344] rounded-2xl flex items-end px-4 py-2">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Сообщение"
                    rows={1}
                    className="flex-1 bg-transparent text-white placeholder-[#708fa0] resize-none focus:outline-none text-sm max-h-32 leading-5"
                    style={{ minHeight: "20px" }}
                  />
                  <button className="w-6 h-6 flex items-center justify-center text-[#708fa0] hover:text-white ml-2 flex-shrink-0">
                    😊
                  </button>
                </div>
                <button
                  onClick={sendMessage}
                  className="w-10 h-10 rounded-full bg-[#2ea6ff] flex items-center justify-center text-white hover:bg-[#1a8de0] transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          // Channel View
          <>
            <div className="h-14 bg-[#17212b] border-b border-[#0d1923] flex items-center px-4 gap-3">
              {isMobile && (
                <button
                  onClick={() => setShowSidebar(true)}
                  className="text-[#708fa0] hover:text-white mr-1"
                >
                  ←
                </button>
              )}
              <Avatar name={activeChat.channel.name} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-white font-semibold text-sm truncate">{activeChat.channel.name}</p>
                  <svg className="w-3.5 h-3.5 text-[#2ea6ff] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-[#708fa0] text-xs">{formatCount(activeChat.channel.subscribers_count)} подписчиков</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Check if user is owner to show post button */}
                <button
                  onClick={() => handleSubscribe(activeChat.channel.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    activeChat.channel.is_subscribed
                      ? "bg-[#253344] text-[#708fa0]"
                      : "bg-[#2ea6ff] text-white hover:bg-[#1a8de0]"
                  }`}
                >
                  {activeChat.channel.is_subscribed ? "Подписан" : "Подписаться"}
                </button>
                <button className="w-8 h-8 flex items-center justify-center text-[#708fa0] hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Posts */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0d1923]">
              {postsLoading ? (
                <div className="text-center text-[#708fa0] mt-8">Загрузка...</div>
              ) : channelPosts.length === 0 ? (
                <div className="text-center mt-12">
                  <div className="text-5xl mb-3">📢</div>
                  <p className="text-white font-medium mb-1">Нет постов</p>
                  <p className="text-[#708fa0] text-sm">В этом канале пока нет записей</p>
                </div>
              ) : (
                channelPosts.map((post) => (
                  <ChannelPost key={post.id} post={post} channelName={activeChat.channel.name} />
                ))
              )}
            </div>

            {/* Post input (for channel owners) */}
            {showPostInput ? (
              <div className="p-3 bg-[#17212b] border-t border-[#0d1923]">
                <div className="flex items-end gap-2">
                  <div className="flex-1 bg-[#253344] rounded-2xl px-4 py-2">
                    <textarea
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      placeholder="Написать пост..."
                      rows={3}
                      className="w-full bg-transparent text-white placeholder-[#708fa0] resize-none focus:outline-none text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setShowPostInput(false)}
                      className="w-10 h-10 rounded-full bg-[#253344] flex items-center justify-center text-[#708fa0] hover:text-white"
                    >
                      ✕
                    </button>
                    <button
                      onClick={sendPost}
                      className="w-10 h-10 rounded-full bg-[#2ea6ff] flex items-center justify-center text-white hover:bg-[#1a8de0]"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#17212b] border-t border-[#0d1923] flex justify-end">
                <button
                  onClick={() => setShowPostInput(true)}
                  className="flex items-center gap-2 bg-[#2ea6ff] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1a8de0] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Написать пост
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1c2733] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white text-lg font-bold mb-4">Создать канал</h3>
            <div className="mb-3">
              <label className="block text-[#708fa0] text-xs mb-1 uppercase">Название</label>
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="Название канала"
                className="w-full bg-[#253344] border border-[#2f4053] rounded-xl px-4 py-3 text-white placeholder-[#4a6278] focus:outline-none focus:border-[#2ea6ff] text-sm"
                autoFocus
              />
            </div>
            <div className="mb-5">
              <label className="block text-[#708fa0] text-xs mb-1 uppercase">Описание</label>
              <textarea
                value={newChannelDesc}
                onChange={(e) => setNewChannelDesc(e.target.value)}
                placeholder="Описание (необязательно)"
                rows={2}
                className="w-full bg-[#253344] border border-[#2f4053] rounded-xl px-4 py-3 text-white placeholder-[#4a6278] focus:outline-none focus:border-[#2ea6ff] text-sm resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateChannel(false)}
                className="flex-1 bg-[#253344] text-[#708fa0] py-2.5 rounded-xl text-sm font-medium hover:bg-[#2b3c4e]"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateChannel}
                disabled={!newChannelName.trim() || creating}
                className="flex-1 bg-[#2ea6ff] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#1a8de0] disabled:opacity-50"
              >
                {creating ? "Создание..." : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatItem({ name, lastMessage, time, isActive, onClick }: {
  name: string;
  lastMessage: string | null;
  time: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
        isActive ? "bg-[#2b5278]" : "hover:bg-[#1c2c3a]"
      }`}
    >
      <Avatar name={name} size={50} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-white font-medium text-sm truncate">{name}</span>
          <span className="text-[#708fa0] text-xs flex-shrink-0 ml-2">{time}</span>
        </div>
        <p className="text-[#708fa0] text-xs truncate">{lastMessage || "Нет сообщений"}</p>
      </div>
    </div>
  );
}

function ChannelItem({ channel, isActive, onClick }: {
  channel: Channel;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
        isActive ? "bg-[#2b5278]" : "hover:bg-[#1c2c3a]"
      }`}
    >
      <Avatar name={channel.name} size={50} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-white font-medium text-sm truncate">{channel.name}</span>
            <svg className="w-3.5 h-3.5 text-[#2ea6ff] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[#708fa0] text-xs flex-shrink-0 ml-2">{formatTime(channel.last_post_at)}</span>
        </div>
        <p className="text-[#708fa0] text-xs truncate">{channel.last_post || channel.description || "Нет постов"}</p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <div className={`flex ${message.is_mine ? "justify-end" : "justify-start"} mb-1`}>
      {!message.is_mine && (
        <div className="mr-2 flex-shrink-0 self-end">
          <Avatar name={message.sender.first_name || "?"} size={28} />
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 ${
          message.is_mine
            ? "bg-[#2b5278] rounded-br-sm"
            : "bg-[#182533] rounded-bl-sm"
        }`}
      >
        {!message.is_mine && (
          <p className="text-[#2ea6ff] text-xs font-medium mb-0.5">
            {[message.sender.first_name, message.sender.last_name].filter(Boolean).join(" ")}
          </p>
        )}
        <p className="text-white text-sm leading-5 break-words">{message.text}</p>
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span className="text-[#708fa0] text-xs">{formatTime(message.created_at)}</span>
          {message.is_mine && (
            <svg className="w-3.5 h-3.5 text-[#2ea6ff]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelPost({ post, channelName }: { post: Post; channelName: string }) {
  return (
    <div className="bg-[#182533] rounded-2xl overflow-hidden shadow-sm">
      {/* Post Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Avatar name={channelName} size={32} />
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <span className="text-white text-sm font-medium">{channelName}</span>
            <svg className="w-3.5 h-3.5 text-[#2ea6ff]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-[#708fa0] text-xs">{formatTime(post.created_at)}</p>
        </div>
      </div>

      {/* Post Content */}
      <div className="px-4 pb-3">
        <p className="text-white text-sm leading-6 whitespace-pre-wrap">{post.text}</p>
      </div>

      {/* Post Footer */}
      <div className="px-4 py-2 border-t border-[#0d1923] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1 text-[#708fa0] hover:text-[#2ea6ff] transition-colors text-xs">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            Нравится
          </button>
          <button className="flex items-center gap-1 text-[#708fa0] hover:text-[#2ea6ff] transition-colors text-xs">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Поделиться
          </button>
        </div>
        <div className="flex items-center gap-1 text-[#708fa0] text-xs">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          {formatCount(post.views_count)}
        </div>
      </div>
    </div>
  );
}