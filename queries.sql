CREATE TABLE series (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  last_season INTEGER,
  last_episode INTEGER
);

INSERT INTO series (title, last_season, last_episode) VALUES ('Virgin River', 5, 10), ('Lupin', 3, 4), ('Gossip Girl', 2, 7), ('Fauda', 4, 12), ('Good Doctor', 5, 18);