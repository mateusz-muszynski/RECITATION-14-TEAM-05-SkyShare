DROP TABLE IF EXISTS users CASCADE; 
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY NOT NULL,
  username VARCHAR(50),
  password CHAR(60) NOT NULL
);


DROP TABLE IF EXISTS followers CASCADE;
CREATE TABLE IF NOT EXISTS followers (
  user_id INT NOT NULL,
  following_id INT NOT NULL,
  PRIMARY KEY (user_id, following_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (following_id) REFERENCES users(user_id)
);


DROP TABLE IF EXISTS photos CASCADE;  
CREATE TABLE IF NOT EXISTS photos (
  photo_id SERIAL PRIMARY KEY NOT NULL,
  user_id INT NOT NULL,
  image_caption VARCHAR(200),
  location VARCHAR(255),
  image_url VARCHAR(300) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
); /* hello */