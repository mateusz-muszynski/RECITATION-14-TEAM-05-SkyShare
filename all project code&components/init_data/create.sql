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
  photo_state varchar(250), /* valid inputs are Colorado, California, Montana, etc */
 /* photo_description VARCHAR(255), */
  photo_url VARCHAR(400),
  user_id INT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);



/* WE DO NOT NEED THIS TABLE !!!!
DROP TABLE IF EXISTS photos_to_users CASCADE; 
CREATE TABLE IF NOT EXISTS photos_to_users (
  photo_id INT,
  user_id INT,
  FOREIGN KEY (photo_id) REFERENCES photos(photo_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
); */