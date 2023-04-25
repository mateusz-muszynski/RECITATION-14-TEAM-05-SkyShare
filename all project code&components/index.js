// *****************************************************
// <!-- Section 1 : Import Dependencies --> 
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcrypt'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part B.


// these are used for the uploading image stuff!!!!!!!
const cloudinary = require("./cloudinary");
const uploader = require("./multer");

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// database configuration
const dbConfig = {
  host: 'db', // the database server
  port: 5432, // the database port
  database: process.env.POSTGRES_DB, // the database name
  user: process.env.POSTGRES_USER, // the user account to connect with
  password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

app.set('view engine', 'ejs'); // set the view engine to EJS
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

// initialize session variables
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

// TODO - Include your API routes here
app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' }); // this api was just added as a sample positive test case thing for lab 11
});

// "Let's add our first route"
app.get('/', (req, res) => {
  res.redirect('/login'); //this will call the /anotherRoute route in the API
});


// API Route for Register​
app.get('/register', (req, res) => {
  res.render('pages/register.ejs');
});


// "Now that we understand how async and await works, let's build the route."
// Register
app.post('/register', async (req, res) => {
  // Check if username or password is empty
  if (!req.body.username || !req.body.password) {
    res.render('pages/register', { message: 'Username and password are required.' });
    return;
  }
  // we dont check if user tries registering with an already existing username lol...
  //hash the password using bcrypt library
  const hash = await bcrypt.hash(req.body.password, 10);

  // To-DO: Insert username and hashed password into 'users' table
  db.query('INSERT INTO users (username, password) VALUES ($1, $2)', [req.body.username, hash])
    .then(() => {
      // Redirect to GET /login route page after data has been inserted successfully
      res.redirect('/login');
    })
    .catch((error) => {
      // If the insert fails, redirect to GET /register route
      res.redirect('/register');
    });
});



// API route for Login              
app.get('/login', (req, res) => {
  res.render('pages/login');
});

app.post('/login', async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  // Check if username or password is empty
  if (!username || !password) {
    res.render('pages/login', { message: 'Please enter both username and password.' });
    return;
  }

  try {
    const user = await db.query('SELECT * FROM users WHERE username = $1', [username]);

    if (user.length === 0) {
      res.render('pages/register', { message: 'Username does not exist, redirecting back to register page.' });
      // res.redirect('/register');
      return;
    }

    const match = await bcrypt.compare(password, user[0].password);

    if (!match) {
      res.render('pages/login', { message: 'Incorrect  password.' });
      return;
    }

    // save the session! so the user currently logged in's info is retained throughout
    req.session.user = {
      user_id: user[0].user_id,
      username: user[0].username,
      password: user[0].password
    };
    req.session.save();

    console.log('SAVEDUSERID' + req.session.user.user_id);

    res.redirect('/home');

  } catch (err) {
    console.log(err);
    res.render('pages/login', { message: 'database request fail' });
  }
});

// Authentication Middleware.
const auth = (req, res, next) => {
  if (!req.session.user) {
    // Default to login page.
    return res.redirect('/login');
  }
  next();
};

// Authentication Required
app.use(auth);


// ii. API route for home
app.get('/home', (req, res) => {
  if (!req.session.user) {
    res.redirect('/login');
    return;
  }

  // Query to get a random followed user's information
  const randomFollowedUserQuery = `
    SELECT u.user_id, u.username
    FROM followers AS f
    JOIN users AS u ON f.following_id = u.user_id
    WHERE f.user_id = $1
    ORDER BY RANDOM()
    LIMIT 3`;
  const recentUserImagesQuery = `
    SELECT photo_url
    FROM photos
    WHERE user_id = $1
    ORDER BY photo_id DESC
    LIMIT 2` ;
  const randomFollowedUserImageQuery = `
    SELECT p.photo_url, p.photo_state, u.username
    FROM (
      SELECT user_id, MAX(photo_id) as max_photo_id
      FROM photos
      WHERE user_id = ANY($1)
      GROUP BY user_id
    ) AS latest
    JOIN photos AS p ON latest.max_photo_id = p.photo_id
    JOIN users AS u ON p.user_id = u.user_id`;
  



  // Execute the query
  db.task(async t => {
    const randomFollowedUsers = await t.any(randomFollowedUserQuery, [req.session.user.user_id]);
    const recentUserImages = await t.any(recentUserImagesQuery, [req.session.user.user_id]);
  
    const followedUserIds = randomFollowedUsers.map(user => user.user_id);
    const randomFollowedUserImages = await t.any(randomFollowedUserImageQuery, [followedUserIds]);
  
    return { randomFollowedUsers, recentUserImages, randomFollowedUserImages };
  })
    .then(({ randomFollowedUsers, recentUserImages, randomFollowedUserImages }) => {
      res.render('pages/home.ejs', {
        username: req.session.user.username,
        randomFollowedUsers: randomFollowedUsers,
        recentUserImages: recentUserImages,
        randomFollowedUserImages: randomFollowedUserImages,
      });
    })
    .catch(err => {
      console.error(err);
      return res.status(500).send('Error fetching data');
    });  
});

// i. API route for Logout​   
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.render('pages/login', { message: 'Logged out Successfully' });
});









// *************************************************************************     THE `FOLLOWING` PAGE !!!!!!!!!!!
// user can input other usernames to follow.
//a list of usernames that they currently follow + photos those usernames uploaded are all displayed
// important: a user can choose to follow themselves! 

// API route: user inputs the username of person they want to follow 
app.get('/friends', (req, res) => {
  console.log("jennifer")
  const userId = req.session.user.user_id;
  const query = 'SELECT username FROM users JOIN followers ON users.user_id = followers.following_id WHERE followers.user_id = $1';
  db.query(query, [userId])
    .then(result => {
      console.log("jennifer2")
      const usernames = result.map(row => row.username);
      const promises = usernames.map(username => {
        return db.any('SELECT photo_url, photo_state FROM photos WHERE user_id = (SELECT user_id FROM users WHERE username = $1)', [username])
          .then(result => {
            const photoUrls = result.map(row => ({ photo_url: row.photo_url, photo_state: row.photo_state }));
            return { username, photoUrls };
          });
      });
      return Promise.all(promises);
    })
    .then(followedUsers => {
      res.render('pages/friends', { followedUsers });
    })
    .catch(error => {
      console.error(error);
      res.status(500).send('Error retrieving followed usernames and photos');
    });
});


// API route that gets the user inputted photo file and converts it to url using cloudinary and then inserts that photo_url generated into the photos table
app.post('/friends', (req, res) => {
  const userId = req.session.user.user_id;
  const username = req.body.username;

  // Look up the user_id of the user being followed
  const query = 'SELECT user_id FROM users WHERE username = $1';
  db.query(query, [username])
    .then(result => {
      if (!result || result.length === 0 || result[0].user_id.length === 0) {
        const query = 'SELECT username FROM users JOIN followers ON users.user_id = followers.following_id WHERE followers.user_id = $1';
        db.query(query, [userId])
          .then(result => {
            const usernames = result.map(row => row.username);
            res.redirect('/friends') // user tries following a username that dne in database
          })
          .catch(error => {
            console.error(error);
            res.status(500).send('Error retrieving followed usernames');
          });
        return;
      }

      // Check if the user is already following the username
      const followingId = result[0].user_id;
      const selectQuery = 'SELECT * FROM followers WHERE user_id = $1 AND following_id = $2';
      db.query(selectQuery, [userId, followingId])
        .then(followers => {
          if (followers.length > 0) {
            const query = 'SELECT username FROM users JOIN followers ON users.user_id = followers.following_id WHERE followers.user_id = $1';
            db.query(query, [userId])
              .then(result => {
                const usernames = result.map(row => row.username);
                res.redirect('/friends'); // ur already following them
              })
              .catch(error => {
                console.error(error);
                res.status(500).send('Error retrieving followed usernames');
              });
            return;
          }

          // Insert the new follower into the database
          const insertQuery = 'INSERT INTO followers (user_id, following_id) VALUES ($1, $2)';
          db.query(insertQuery, [userId, followingId])
            .then(result => {
              const query = 'SELECT username FROM users JOIN followers ON users.user_id = followers.following_id WHERE followers.user_id = $1';
              db.query(query, [userId])
                .then(followedUsers => {
                  const usernames = followedUsers.map(row => row.username);
                  res.redirect('/friends'); // success.. ur now following them
                })
                .catch(error => {
                  console.error(error);
                  res.status(500).send('Error retrieving followed usernames');
                });
            })
            .catch(error => {
              console.error(error);
              res.status(500).send('Error inserting follower into database');
            });
        })
        .catch(error => {
          console.error(error);
          res.status(500).send('Error checking if user is already following');
        });
    })
    .catch(error => {
      console.error(error);
      res.status(500).send('Error looking up user by username');
    });
});




// API route to unfollow a user!!!!!!!!!!!!!
app.post('/unfollow', (req, res) => {
  console.log('jennifer4');
  const userId = req.session.user.user_id;
  const username = req.body.usernameU;

  // Look up the user_id of the user trying to be unfollowed
  const query = 'SELECT user_id FROM users WHERE username = $1';
  db.query(query, [username])
    .then(result => {
      if (!result || result.length === 0 || result[0].user_id.length === 0) {
        const query = 'SELECT username FROM users JOIN followers ON users.user_id = followers.following_id WHERE followers.user_id = $1';
        db.query(query, [userId])
          .then(result => {
            const usernames = result.map(row => row.username);
            res.redirect('/friends') // user tries unfollowing a username that dne in database
          })
          .catch(error => {
            console.error(error);
            res.status(500).send('Error retrieving followed usernames');
          });
        return;
      }

      const followingId = result[0].user_id;
      const selectQuery = 'SELECT * FROM followers WHERE user_id = $1 AND following_id = $2';
      db.query(selectQuery, [userId, followingId])
        .then(followers => {
          if (followers.length === 0) { // check if the user is already not following the username. if so, then j redirect to the same page..
            //res.status(400).send('You are not currently following this user.');
            res.redirect('/friends')
            return;
          }

          const query = 'SELECT username FROM users JOIN followers ON users.user_id = followers.following_id WHERE followers.user_id = $1';
          db.query(query, [userId])
            .then(result => {
              const deleteQuery = 'DELETE FROM followers WHERE user_id = $1 AND following_id = $2';
              db.query(deleteQuery, [userId, followingId])
                .then(result => {
                  res.redirect('/friends');
                })
                .catch(error => {
                  console.error(error);
                  res.status(500).send('Error deleting follower from database');
                });
            })
            .catch(error => {
              console.error(error);
              res.status(500).send('Error retrieving followed usernames');
            });
        })
        .catch(error => {
          console.error(error);
          res.status(500).send('Error checking if user is already following');
        });
    })
    .catch(error => {
      console.error(error);
      res.status(500).send('Error looking up user by username');
    });
});


// map related routes start here
app.get('/map', async (req, res) => {
  // TO-DO
  // 查所有的state
  // then 根据每个state_id查对应state下所有的photos
  const selectquery = `SELECT state_id, state_name, lat, lng FROM states;`

  const selectphotoquery = `SELECT users.username, photos.photo_description, photos.photo_url FROM photos FULL JOIN users ON photos.user_id = users.user_id WHERE photos.photo_state = $1;`

  await db.query(selectquery)
    .then(async states => {
      console.log(states)
      for (let i = 0; i < states.length; i++) {
        var state_name = states[i].state_name;
        
        await db.query(selectphotoquery, [state_name])
          .then(photos => {
            states[i]['photos'] = photos;
          })
      }
      var data = {
        states: states,
      }
      console.log(data.states[44].photos[0]);
      res.render('pages/map', {
        data: data
      });
    });

    

  // 前端需要location的信息 生成marker
});




// *************************************************************************     THE `MY PHOTOS` PAGE !!!!!!!!!!!
// user can upload their own photos and the location (US State) they took the photo
// this page also displays all the photos the user uploaded


/* API route for uploadphoto. this gets the photo_url(s) associated w the user in session, and then in the ejs, it uses forEach to display them all */
app.get('/upload', (req, res) => {
  //db.any('SELECT photo_url FROM photos WHERE user_id = $1', [req.session.user.user_id]) // this is if we just get the photourl and not the location
  db.any('SELECT photo_url, photo_state FROM photos WHERE user_id = $1', [req.session.user.user_id]) // get photo_state as well so we can display it on page
    .then((result) => {
      console.log("result::" + result);
      //const photoUrls = result;  // this is if we just get the photourl and not the location
      const photoUrls = result.map(row => ({ photo_url: row.photo_url, photo_state: row.photo_state })); // getting photo_state as well

      console.log("FGHJKHJGJHJ:", photoUrls)
      res.render('pages/upload', { photoUrls: photoUrls });
    })
    .catch((error) => {
      res.render('pages/upload', { message: 'erorr couldnt display photo', photoUrls: [] });
    });
});


//API route 
// given user input of a photo file, this generates a url for that file and stores it in the photos table
app.post("/upload", uploader.single("recfile"), async (req, res) => { // bro this actually works omg??!!?!?!???!?!?
  console.log("HELLOOO")
  const upload = await cloudinary.v2.uploader.upload(req.file.path);

  // write db query to insert in table!
  // first, get the user id of the person posting the photo
  const userId = req.session.user.user_id;
  const state = req.body.state; // Retrieve the selected state from the request body
  db.query('select * from users where user_id = $1', [userId])
    .then(() => {
      // once u successfully get userid, insert the data into photos table
      db.query('INSERT INTO photos (photo_url, photo_state, user_id) VALUES ($1, $2, $3)', [upload.secure_url, state, userId, state]) // insert location into the photos table
        .then(() => {
          // res.render('pages/upload',{ message: 'success', photoUrls: []});
          res.redirect('/upload');
        })
        .catch((error) => {
          // If the insert fails, redirect to GET /register route
          res.render('pages/upload', { message: 'not success', photoUrls: [] });
        });
    })
    .catch((error) => {
      // If it failed
      res.render('pages/upload', { message: 'no user ' });
    });
});


//delete a photo!
app.post('/delete-photo', (req, res) => {
  const photoUrl = req.body.photo_url;

  db.none('DELETE FROM photos WHERE photo_url = $1', [photoUrl])
    .then(() => {
      res.redirect('/upload');
    })
    .catch((error) => {
      console.error(error);
      res.redirect('/upload');
    });
});

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');













/*
app.get('/friends', (req, res) => {
  res.render('pages/friends');
}); 
 */
/* 
app.post('/friends', (req, res) => {
  const userId = req.session.user.user_id;
  const username = req.body.username;

  // Look up the user_id of the user being followed
  const query = 'SELECT user_id FROM users WHERE username = $1';
  db.query(query, [username])
    .then(result => {
      if (!result || result.length === 0 || result[0].user_id.length === 0) {
        const query = 'SELECT username FROM users JOIN followers ON users.user_id = followers.following_id WHERE followers.user_id = $1';
        db.query(query, [userId])
          .then(result => {
            const usernames = result.map(row => row.username);
            res.render('pages/friends', { message: "User not found", usernames });
          })
          .catch(error => {
            console.error(error);
            res.status(500).send('Error retrieving followed usernames');
          });
        return;
      }

      // Check if the user is already following the username
      const followingId = result[0].user_id;
      const selectQuery = 'SELECT * FROM followers WHERE user_id = $1 AND following_id = $2';
      db.query(selectQuery, [userId, followingId])
        .then(followers => {
          if (followers.length > 0) {
            const query = 'SELECT username FROM users JOIN followers ON users.user_id = followers.following_id WHERE followers.user_id = $1';
            db.query(query, [userId])
              .then(result => {
                const usernames = result.map(row => row.username);
                res.render('pages/friends', { message: `You are already following user ${username}`, followedUsers: [], usernames });
              })
              .catch(error => {
                console.error(error);
                res.status(500).send('Error retrieving followed usernames');
              });
            return;
          }

          // Insert the new follower into the database
          const insertQuery = 'INSERT INTO followers (user_id, following_id) VALUES ($1, $2)';
          db.query(insertQuery, [userId, followingId])
            .then(result => {
              const query = 'SELECT username FROM users JOIN followers ON users.user_id = followers.following_id WHERE followers.user_id = $1';
              db.query(query, [userId])
                .then(followedUsers => {
                  const usernames = followedUsers.map(row => row.username);
                  res.render('pages/friends', { message: `You are now following user ${username}`, followedUsers, usernames });
                })
                .catch(error => {
                  console.error(error);
                  res.status(500).send('Error retrieving followed usernames');
                });
            })
            .catch(error => {
              console.error(error);
              res.status(500).send('Error inserting follower into database');
            });
        })
        .catch(error => {
          console.error(error);
          res.status(500).send('Error checking if user is already following');
        });
    })
    .catch(error => {
      console.error(error);
      res.status(500).send('Error looking up user by username');
    });
});
*/

/*
// REDIRECT_MESSAGE1 (user tries following a username that dne in database)
app.get('/friends1', (req, res) => {
  const message = req.query.message;
  const usernames = req.query.usernames;
  res.render('pages/friends', { message, usernames });
});
// REDIRECT_MESSAGE2   (user tries following a username theyre already following)
app.get('/friends2', (req, res) => {
  const { message, usernames } = req.query;
  const parsedUsernames = JSON.parse(usernames);
  res.render('pages/friends', { message, followedUsers: [], usernames: parsedUsernames });
});
//REDIRECT_MESSAGE3 (success! user is now following <username>)
app.get('/friends3', (req, res) => {
  const { message, followedUsers, usernames } = req.query;
  res.render('pages/friends', { message: message ? decodeURIComponent(message) : '', followedUsers: followedUsers ? JSON.parse(decodeURIComponent(followedUsers)) : [], usernames: usernames ? JSON.parse(decodeURIComponent(usernames)) : [] });
}); */