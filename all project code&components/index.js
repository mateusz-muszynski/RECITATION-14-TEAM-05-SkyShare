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



// parta : ii. API route for Login              // EDIT THIS  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
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
/*
// console.log('!!!!! REQ:', req);
axios({
  url: `https://app.ticketmaster.com/discovery/v2/events.json`,
// url: `https://app.ticketmaster.com/discovery/v2/events.json?apikey=XHb4O8bIHkk2Czh363uBw8XKdrg1L8Uv`,
  method: 'GET',
  dataType: 'json',
  headers: {
    'Accept-Encoding': 'application/json',
  },
  params: {
    apikey: process.env.API_KEY,
    keyword: 'Taylor Swift', //you can choose any artist/event here 
    size: 10,
  },
})
  .then(results => {
    console.log(results.data._embedded.events); // the results will be displayed on the terminal if the docker containers are running // Send some parameters
    res.render('pages/discover.ejs', {results: results.data._embedded.events});
  })
  .catch(error => {
    console.log(error);
    // Handle errors
   res.render('pages/discover.ejs', { results: [], message: 'Error: could not fetch events.'});
  }); */

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

app.get('/nasa', async (req, res) => {
  //res.render('https://api.nasa.gov/planetary/apod?api_key=r6ZWlU2Jp8qOOLeqsbl6EYaI4NV64x4AcTzUtt6z');
  

  axios({
    url: `localhost:3000/v1/apod?api_key=r6ZWlU2Jp8qOOLeqsbl6EYaI4NV64x4AcTzUtt6z&date=2014-10-01&concept_tags=True`,
    method: 'GET',
    dataType: 'json',
    headers: {
      'Accept-Encoding': 'application/json',
    },
    params: {
      apikey: process.env.r6ZWlU2Jp8qOOLeqsbl6EYaI4NV64x4AcTzUtt6z,
      keyword: 'resource', //you can choose any artist/event here
      size: 1,
    },
    resource: {
      image_set: "apod"
    },
  })
//okay so you need to take this informations and make a new const query to add the data into and then assign it like a regular
//get function and then create the nasa table make a json object blah blah actally create the json object first and then use the const query to put the crap
//in there using the names you set when you gathered the info cool? cool. the json object should be named data i think i dont actually know but that might be correct 
    
    .then(results => {

      console.log(results.resource); // the results will be displayed on the terminal if the docker containers are running // Send some parameters
    })
    .catch(error => {
      console.error(error);
      res.status(500).send('error gathering nasa data');
    });

}); 

app.get('/nasa', async (req,res) =>{
  res.render('pages/nasa', {
  });
})
//<h1 name="title" value="<%-nasa.title%>"><%= nasa.title %></h1>

/*app.put('https://api.nasa.gov/planetary/apod?api_key=r6ZWlU2Jp8qOOLeqsbl6EYaI4NV64x4AcTzUtt6z', function(req,res) {
  var query = 'update nasa set copyright =$1, date_n=$2, explanation=$3, hdurl=$4, media_type=$5, service_version=$6, title=$7, url_n=$8 where nasa_id = 1 returning *;';

  db.task('put-everything', task=> {
    return task.any(query, [
      req.body.copyright,
      req.body.date,
      req.body.explanation,
      req.body.hdurl,
      req.body.media_type,
      req.body.service_version,
      req.body.title,
      req.body.url,
    ]);
  })

  .then(data=> {
    res.status(201).json({
      status: 'success',
      query: data,
      massage: 'data added successfully',
    });
  })
  .catch(function(err) {
    return console.log(err);
  });
})

*/
// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');



