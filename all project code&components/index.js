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


// these are used for the uploading image stuff 
const cloudinary = require("./cloudinary");
const uploader = require("./multer");




app.post("/upload", uploader.single("recfile"), async (req, res) => {
  console.log("HELLOOO")
  const upload = await cloudinary.v2.uploader.upload(req.file.path);
  return res.json({
    success: true,
    file: upload.secure_url,
  });
  
});



// const multer = require('multer'); //cgpt
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

  // TODO - Include your API routes here
// "Let's add our first route"
app.get('/', (req, res) => {
  res.redirect('/login'); //this will call the /anotherRoute route in the API
});


//part a  ii. API Route for Register​
app.get('/register', (req, res) => {
  res.render('pages/register.ejs');   // Response: Render register.ejs page (???? should it b res.render('register.ejs');)
});


// "Now that we understand how async and await works, let's build the route."
// Register
app.post('/register', async (req, res) => {
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



// parta : ii. API route for Login              
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






// app.get('/discover', (req, res) => { comment
//   res.render('pages/discover.ejs');
// });

// ii. API route for home
app.get('/home', (req, res) => {
  res.render('pages/home.ejs');
});



// i. API route for Logout​   

app.get("/logout", (req, res) => {
req.session.destroy();
res.render('pages/login', { message: 'Logged out Successfully' });
});


// added shit

// API route: user inputs the username of person they want to follow 
// user can follow themselves
app.get('/friends', (req, res) => {
const userId = req.session.user.user_id;
const query = 'SELECT username FROM users JOIN followers ON users.user_id = followers.following_id WHERE followers.user_id = $1';
db.query(query, [userId])
  .then(result => {
    const usernames = result.map(row => row.username);
    res.render('pages/friends', { usernames });
  })
  .catch(error => {
    console.error(error);
    res.status(500).send('Error retrieving followed usernames');
  });
});



app.get('/friends', (req, res) => {
res.render('pages/friends');
}); 

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










// ii. API route for uploadphoto

/*app.get('/uploadPhoto', async (req, res) => { hthis was originally commented 
  try {
    const photosToUsers = await db.query('SELECT photo_id FROM photos_to_users WHERE user_id = $1', [req.session.user.user_id]);
    if (photosToUsers.length === 0) {
      return res.render('pages/uploadPhotos', { message: 'No photos found' });
    }
    const photoId = photosToUsers[0].photo_id;
    const photos = await db.query('SELECT photo_url FROM photos WHERE photo_id = $1', [photoId]);
    if (photos.length === 0) {
      return res.render('pages/uploadPhotos', { message: 'No photo found' });
    }
    const photoUrl = photos[0].photo_url;
    res.render('pages/uploadPhotos', { photoUrl });
  } catch (error) {
    console.log(error);
    res.render('pages/uploadPhotos', { message: 'Failed to get photo URL' });
  }
}); */


app.get('/uploadPhoto', (req, res) => {
  db.query('SELECT photo_url FROM photos WHERE user_id = $1', [req.session.user.user_id])
  .then((result) => {
    let photoUrls = [];
    if (result.rows.length > 0) {
      photoUrls = result.rows.map(row => row.photo_url);
    }
    res.render('pages/uploadPhoto', { message: 'success', photoUrls: photoUrls });
  })
  .catch((error) => {
    res.render('pages/uploadPhoto', { message: 'erorr couldnt display photo', photoUrls: [] });
  });
}); 

/* this one was originally commented
app.get('/uploadPhoto', (req, res) => {
  //res.render('pages/uploadPhoto.ejs');

  // db query select photo_id from photos to users where userid = req.session.userid or whatever

  // db query from photos table to get url 
  //once u get the url, in ejs page do <img url = >
  db.query('select photo_id from photos where user_id = $1', [req.session.user.user_id])
  .then(() => {
      // db query from photos table to get url 
        db.query('select photo_url from photos where photo_id = $1', [result])
      .then(() => {
        //  incomplete code, I want to send this url to the uploadPhotos ejs 
      })
      .catch((error) => {
        res.render('pages/uploadPhotos', { message: "error" });
      });
  })
  .catch((error) => {
    res.render('pages/uploadPhoto', { message: "error lol " });
  });
}); */



/*
app.post('/uploadPhoto', async (req, res) => {
  const file = req.files.photo;
  try {
    const cloudinaryRes = await cloudinary.uploader.upload(file.tempFilePath, {public_id: "userimg"
    });

    const url = cloudinary.url("userImage", {
      width: 100,
      height: 150,
      Crop: 'fill'
    });

    await db.query('INSERT INTO photos (photo_url) VALUES ($1)', [cloudinaryRes.secure_url]);
    
    res.render('pages/uploadPhotos', { message: 'success' });
  } catch (error) {
    console.log(error);
    res.render('pages/uploadPhotos', { message: 'not success' });
  }
});  */














/*
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now())
  }
});
const upload = multer({ storage: storage });

// this one was originally commented.. TA ash
app.post('/uploadPhoto', async (req, res) => {
  //const file = req.files.photo
console.log("something")
const {image} = req.files;
console.log(image);

  res = cloudinary.uploader.upload(req.files.photo, {public_id: "userimg"})
  res.then((data) => {
    console.log(data);
    console.log(data.secure_url);
  }).catch((err) => {
    console.log(err);
  });
  
  
  // Generate 
  const url = cloudinary.url("userImage", {
    width: 100,
    height: 150,
    Crop: 'fill'
  });
  
  
  
  // The output url
  console.log(url);



  //write db query to insert in table

db.query('INSERT INTO photos (photo_url) VALUES ($1)', [url])
.then(() => {
  // Redirect to GET /login route page after data has been inserted successfully
  res.render('pages/uploadPhotos',{ message: 'success' });
})
.catch((error) => {
  // If the insert fails, redirect to GET /register route
  res.render('pages/uploadPhotos',{ message: 'not success' });
});

}); 
 */

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');



