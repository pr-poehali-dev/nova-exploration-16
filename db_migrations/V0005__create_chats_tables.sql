CREATE TABLE IF NOT EXISTS t_p8426475_nova_exploration_16.chats (
  id SERIAL PRIMARY KEY,
  chat_type VARCHAR(20) NOT NULL,
  name VARCHAR(100),
  avatar_url TEXT,
  created_by INTEGER REFERENCES t_p8426475_nova_exploration_16.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p8426475_nova_exploration_16.chat_members (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER REFERENCES t_p8426475_nova_exploration_16.chats(id),
  user_id INTEGER REFERENCES t_p8426475_nova_exploration_16.users(id),
  role VARCHAR(20) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(chat_id, user_id)
);