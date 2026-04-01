CREATE TABLE IF NOT EXISTS t_p8426475_nova_exploration_16.sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES t_p8426475_nova_exploration_16.users(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);