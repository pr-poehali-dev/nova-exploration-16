CREATE TABLE IF NOT EXISTS t_p8426475_nova_exploration_16.channels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) UNIQUE,
  description TEXT,
  avatar_url TEXT,
  owner_id INTEGER REFERENCES t_p8426475_nova_exploration_16.users(id),
  is_public BOOLEAN DEFAULT TRUE,
  subscribers_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);