DROP TABLE IF EXISTS users CASCADE; 
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY NOT NULL,
  username VARCHAR(50) unique,
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

DROP TABLE IF EXISTS states CASCADE; 
CREATE TABLE IF NOT EXISTS states (
  state_id SERIAL PRIMARY KEY NOT NULL,
  state_name VARCHAR(200),
  lng DECIMAL NOT NULL,
  lat DECIMAL NOT NULL
);

DROP TABLE IF EXISTS photos CASCADE; 
CREATE TABLE IF NOT EXISTS photos (
  photo_id SERIAL PRIMARY KEY NOT NULL,
  user_id INT NOT NULL,
  photo_state VARCHAR(250),
  photo_description VARCHAR(200),
  photo_url VARCHAR(300) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

DROP TABLE IF EXISTS nasa CASCADE;
CREATE TABLE IF NOT EXISTS nasa(
   nasa_id SERIAL PRIMARY KEY NOT NULL,
   current_space VARCHAR(100) NOT NULL,
   hdate VARCHAR(300) NOT NULL,
   title VARCHAR(100) NOT NULL,
   hdurl VARCHAR(100) NOT NULL,
   explanation TEXT NOT NULL
);



/* WE DO NOT NEED THIS TABLE !!!!
DROP TABLE IF EXISTS photos_to_users CASCADE; 
CREATE TABLE IF NOT EXISTS photos_to_users (
  photo_id INT,
  user_id INT,
  FOREIGN KEY (photo_id) REFERENCES photos(photo_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
); */