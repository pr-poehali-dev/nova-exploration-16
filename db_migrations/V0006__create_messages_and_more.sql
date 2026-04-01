CREATE TABLE IF NOT EXISTS t_p8426475_nova_exploration_16.messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER REFERENCES t_p8426475_nova_exploration_16.chats(id),
  sender_id INTEGER REFERENCES t_p8426475_nova_exploration_16.users(id),
  text TEXT,
  media_url TEXT,
  media_type VARCHAR(20),
  reply_to_id INTEGER,
  is_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p8426475_nova_exploration_16.channel_posts (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER REFERENCES t_p8426475_nova_exploration_16.channels(id),
  author_id INTEGER REFERENCES t_p8426475_nova_exploration_16.users(id),
  text TEXT,
  media_url TEXT,
  media_type VARCHAR(20),
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p8426475_nova_exploration_16.channel_subscribers (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER REFERENCES t_p8426475_nova_exploration_16.channels(id),
  user_id INTEGER REFERENCES t_p8426475_nova_exploration_16.users(id),
  subscribed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS t_p8426475_nova_exploration_16.contacts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES t_p8426475_nova_exploration_16.users(id),
  contact_id INTEGER REFERENCES t_p8426475_nova_exploration_16.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, contact_id)
);