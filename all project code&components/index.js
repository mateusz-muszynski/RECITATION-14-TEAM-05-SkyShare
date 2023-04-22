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
    res.json({status: 'success', message: 'Welcome!'});
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
  // we dont check if user tries registering with an already existing username lol
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
    res.render('pages/login',{ message: 'database request fail' });
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
  res.render('pages/home.ejs');
});

// i. API route for Logout​   
app.get("/logout", (req, res) => {
req.session.destroy();
res.render('pages/login', { message: 'Logged out Successfully' });
});





// API route: user inputs the username of person they want to follow 
// important: a user can choose to follow themselves! 
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



/*
app.get('/friends', (req, res) => {
  res.render('pages/friends');
}); 
 */

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





/* post route that just would display usernames user is followinf..
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
              res.render('pages/friends', { message: `You are already following user ${username}`, usernames });
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
              .then(result => {
                const usernames = result.map(row => row.username);
                res.render('pages/friends', { message: `You are now following user ${username}`, usernames });
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
        res.status(500).send('Error looking up followers');
      });
  })
  .catch(error => {
    console.error(error);
    res.status(500).send('Error looking up user');
  });
});



*/






/* API route for uploadphoto. this gets the photo_url(s) associated w the user in session, and then in the ejs, it uses forEach to display them all */
app.get('/upload', (req, res) => { 
  //db.any('SELECT photo_url FROM photos WHERE user_id = $1', [req.session.user.user_id])
  db.any('SELECT photo_url, photo_state FROM photos WHERE user_id = $1', [req.session.user.user_id]) // get photo_state as well so we can display it on page
    .then((result) => {
      console.log("result::" + result);
      //const photoUrls = result;
      const photoUrls = result.map(row => ({ photo_url: row.photo_url, photo_state: row.photo_state })); // getting photo_state as well
    /*  if (result.rows.length > 0) {
       // photoUrls = result.rows.map(row => row.photo_url);
       //photoUrls.push(result.row.photo_url)
      } */
      console.log("FGHJKHJGJHJ:" ,photoUrls)
      res.render('pages/upload', { photoUrls: photoUrls });
    })
    .catch((error) => {
      res.render('pages/upload', { message: 'erorr couldnt display photo', photoUrls: [] });
    });
}); 
  

// given user input of a photo file, this generates a url for that file and stores it in the photos table
app.post("/upload", uploader.single("recfile"), async (req, res) => { // bro this actually works omg??!!?!?!???!?!?
    console.log("HELLOOO")
    const upload = await cloudinary.v2.uploader.upload(req.file.path);

  //write db query to insert in table

  // first, get the user id of the person posting the photo
  const userId = req.session.user.user_id;
  const state = req.body.state; // Retrieve the selected state from the request body
  db.query('select * from users where user_id = $1', [userId])
  .then(() => {
      // once u successfully get userid, insert the data into photos table
      db.query('INSERT INTO photos (photo_url, photo_state, user_id) VALUES ($1, $2, $3)', [upload.secure_url, state, userId]) // insert location into the photos table
      .then(() => {
        // res.render('pages/upload',{ message: 'success', photoUrls: []});
        res.redirect('/upload');
      })
      .catch((error) => {
        // If the insert fails, redirect to GET /register route
        res.render('pages/upload',{ message: 'not success', photoUrls: []});
      });
  })
  .catch((error) => {
    // If it failed
    res.render('pages/upload',{ message: 'no user ' });
  });
});



// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');



