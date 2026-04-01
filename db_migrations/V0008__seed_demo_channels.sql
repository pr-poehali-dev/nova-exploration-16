INSERT INTO t_p8426475_nova_exploration_16.channels (name, username, description, owner_id, is_public, subscribers_count) VALUES
  ('Epicgram Новости', 'epicgram_news', 'Официальный канал новостей Epicgram', 1, TRUE, 15420),
  ('Tech Новости', 'tech_news', 'Последние новости из мира технологий', 2, TRUE, 89234),
  ('Крипто Хаб', 'crypto_hub', 'Криптовалюты, NFT, Web3', 3, TRUE, 45123),
  ('Дизайн и UI', 'design_ui', 'Лучшие ресурсы по дизайну', 2, TRUE, 23456),
  ('Программирование', 'dev_channel', 'Советы для разработчиков', 1, TRUE, 67890)
ON CONFLICT (username) DO NOTHING;