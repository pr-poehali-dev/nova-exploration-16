INSERT INTO t_p8426475_nova_exploration_16.users (phone, username, first_name, last_name, is_verified) VALUES
  ('+79000000001', 'epicgram_news', 'Epicgram', 'News', TRUE),
  ('+79000000002', 'tech_channel', 'Tech', 'Channel', TRUE),
  ('+79000000003', 'crypto_hub', 'Crypto', 'Hub', TRUE)
ON CONFLICT (phone) DO NOTHING;