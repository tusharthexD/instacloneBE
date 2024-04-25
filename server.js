import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import cors from "cors";
import {SendMail} from './SendMail.js'
import multer from 'multer'
import ffmpeg from "fluent-ffmpeg";
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken';


const app = express();
const port = process.env.port || 3000;
dotenv.config()
const saltRound = 4;
let emailOtp = null
let registeredEmail = null

const JWT_SECRET = 'tusharspamz';

// mongodb+srv://tusharsuthar6:mVDriDKn6BlIIFxi@cluster0.rajtgmf.mongodb.net/mySessions?retryWrites=true&w=majority&appName=Cluster0


// Enable CORS with the specified options
app.use(cors({
  origin: ['http://localhost:5173', 'https://instagramclone-drab.vercel.app'],
  credentials: true, // Allow credentials (cookies, authorization headers, etc.)
}));

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const db = new Pool({
  connectionString: connectionString,
  // If you're using a service like Heroku, you might need this for SSL:
  ssl: {
    rejectUnauthorized: false,
  },
});

db.connect();


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const minute = 1000 * 60; //STORY LOGIC
const hour = minute * 60;

let hours = Math.round(Date.now() / hour);

// Multer configuration for file upload
const upload = multer({ dest: 'uploads/' });


//authenticate for login onlyy
function authenticateToken(req, res, next) {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  if (!token) {
    req.isAuthenticated = false;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.send({isLoggedin : false});
    }
    req.user = user;
    req.isAuthenticated = true;
    next();
  });
}

function authenticateUser(req, res, next) {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  if (!token) {
    req.isLoggedIn = false;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      req.isLoggedIn = false
      next()
    }
    req.isLoggedIn = true;
    req.user = user;
    next();
  });
}

// Endpoint for video trimming
app.post('/api/trim', upload.single('video'),(req, res) => {

 try {
     const { start, end } = req.body;
     const inputFile = req.file.path;
     const outputFile = `uploads/trimmed_${req.file.originalname}`;
     // Trim video
      ffmpeg(inputFile)
 
         .setStartTime(start)
         .setDuration(end - start)
         .size('?x600')
         .format('mp4')
         .output(outputFile)
         .on('end',async () => {
           res.sendFile(outputFile, { root: '.' })
         })
         .on('error', (err) => {
             console.error('Error trimming video:', err);
             res.status(500).json({ error: 'Error trimming video' });
         })
         .run()
 } catch (error) {
  res.json(error)
 }
});



// for login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query("SELECT * FROM users WHERE username = $1", [
      username.toLowerCase(),
    ]);
    let loginPsw = result.rows[0].password;

    if (result.rows.length > 0) {
      bcrypt.compare(password, loginPsw, async (err, valid) => {
        if (valid) {
         
         
          const token = jwt.sign({username: result.rows[0].username, profile: result.rows[0].profile }, JWT_SECRET, { expiresIn: '1d' });
          res.json({ 
            message: "User Loggedin",
            token: token });



        } else if (err) {
          res.json({ isLoggedin: false, message: err });
        } else {
          res.json({
            isLoggedin: false,
            message:
              "Sorry, your password was incorrect. Please double-check your password.",
          });
        }
      });
    } else {
      res.json({ isLoggedin: false, message: "User doesn't exist." });
    }
  } catch (error) {
    res.json({ isLoggedin: false, message: "User not exist" });
  }

});

app.get('/',(req,res)=>{
  res.send("created by Tushar")
})

app.get("/api/",authenticateToken, (req, res)=>{

  if (req.isAuthenticated) {
    const {username, profile} = req.user;
     res.json({ isLoggedin: true, username: username, profile: profile });
  } else {
    res.send({isLoggedin: false})
  }
});


app.post("/api/profile", authenticateUser, async (req, res) => {
  const result = await db.query(
    "SELECT * FROM users join userdata as ud ON ud.username = users.username WHERE users.username = $1",
    [req.body.id]
  );

  let data = {
    user: result.rows[0],
    isFollowed: false,
    isLoggedin: req.isLoggedIn,
    myProfile: false,
  };
  if (result.rows.length > 0) {
       if (data.isLoggedin) {
                if (req.user.username == data.user.username){
                  data.myProfile = true;
                }

                  if (data.user.followers) {
                     let ress = data.user.followers.find(
                     (e) => e == req.user.username);
                     if(ress) data.isFollowed = true
                    }
                    res.json(data)
                  } else {
                    res.json(data)
                  }
                      
      
  } else {
   res.json(null);
  }


});

//profile post
app.post("/api/profile/posts", async (req, res) => {
  const result = await db.query("SELECT * FROM instapost WHERE username = $1", [
    req.body.id,
  ]);
  res.json(result.rows);
});

app.get('/api/profile/edit',authenticateUser,async (req,res)=>{
  if (req.user) {
    const result = await db.query(
    "SELECT * FROM users join userdata as ud ON ud.username = users.username WHERE users.username = $1",
    [req.user.username]
  )
    result.rows[0].password = undefined
    res.json(result.rows[0])
  } else {
    res.json(null)
  }
})
//update profile
app.post('/api/profile/edit',authenticateUser,async (req,res)=>{
  let {profile,fname,lname,bio,website} = req.body
  if (req.user) {
    console.log(req.body, ' call to kar raha h');
   try {
     await db.query(
     "UPDATE users SET profile = $1 WHERE username = $2",
     [profile, req.user.username])
     await db.query(
     "UPDATE userdata SET fname = $1, lname = $2, bio = $3, website = $4 WHERE username = $5",
     [fname, lname,bio,website, req.user.username])
     console.log('response bhi bhejaaa');
     res.send(true)

   } catch (error) {
    console.log(error)
    res.json(error)
   }
  } else {
    console.log('failde');
    res.send(false)
  }
})


// for addpost
app.post("/api/addpost",authenticateUser, async (req, res) => {
  let { id, post, caption } = req.body;
  let t = new Date();
  let time = t.getTime();

  if (req.user) {
    try {
      await db.query(
        "INSERT INTO instapost(id,username,post,likes,caption,comments,time) values($1,$2,$3,$4,$5,$6,$7)",
        [id, req.user.username, post, [], caption, [], time]
      );
      res.json("success");
    } catch (error) {
      console.log(error);
      res.json(error);
    }
  } else {
    res.json('Login first')
  }
});


// for add reel
app.post("/api/addreel",authenticateUser, async (req, res) => {
  if (req.user) {
    let { id, post, caption } = req.body;
  let t = new Date();
  let time = t.getTime();
  try {
    await db.query(
      "INSERT INTO instareels(id,username,post,likes,caption,comments,time) values($1,$2,$3,$4,$5,$6,$7)",
      [id, req.user.username, post, [], caption, [], time]
    );
    res.json("success");
  } catch (error) {
    console.log(error);
    res.json(error);
  }
  } else {
    res.json('login first')
  }
});


//Search user
app.post("/api/search", async (req, res) => {
  try {
    let result = await db.query(
      "SELECT username,profile from users WHERE LOWER(username) LIKE '%' || $1 || '%'",
      [req.body.search]
    );
    res.json(result.rows);
  } catch (error) {
    console.log(error);
  }
});


// post
app.get("/api/posts", async (req, res) => {

  try {
    const result = await db.query("SELECT * from instapost JOIN users ON instapost.username = users.username ");
    res.json(result.rows);
  } catch (error) {
    res.json(error)
  }
});

app.get("/api/reels", async (req, res) => {
  try {
    const result = await db.query("SELECT * from instareels JOIN users ON instareels.username = users.username");
    res.json(result.rows);
  } catch (error) {
    res.json(error)
  }
});

app.post('/api/reset',async (req,res)=>{
  const result = await db.query("SELECT * FROM users WHERE email = $1",[req.body.email])
  if (result.rows.length > 0) {
    emailOtp = Math.round(1000+Math.random()*9000)
    registeredEmail = req.body.email
    console.log(emailOtp);
    SendMail(emailOtp , registeredEmail)
    res.json(true)
  } else {
    res.json(false)
  }
})

app.post('/api/resetpassword', async (req,res)=>{
const {password1, OTP} = req.body;
if (OTP == emailOtp) {
  
  try {
    bcrypt.hash(password1, saltRound, async (err, hash) => {
            if (err) {
              console.log(err);
              res.json(false)
            } else {
              await db.query(
                "UPDATE users SET password = $1 WHERE email = $2",
                [hash, registeredEmail]
              );
              res.json(true)
             
            }
          });
  
    } catch (error) {
      res.json(false);
    }
}
else{
  res.json(false)
}
})

//for story
app.get('/api/story/:id',async (req,res)=>{
try {
  const result = await db.query('SELECT * FROM instastory JOIN users on instastory.username = users.username WHERE id = $1', [req.params.id])
  result.rows[0].password = null
  result.rows[0].email = null
  
  res.json(result.rows[0])
} catch (error) {
  res.json(error)
}

})

app.get('/api/stories',async (req,res)=>{
  const result = await db.query('SELECT instastory.username, id, story, profile FROM instastory JOIN users on instastory.username = users.username')
  res.json(result.rows)

})

// upload Story
app.post('/api/uploadstory',authenticateUser, async (req,res)=>{
const {story, id, type} = req.body
const time =  Math.round(Date.now() /10000)
if (req.user) {
  try {
    
  await db.query('INSERT INTO instastory(story,time,username,id,viewer,type) VALUES($1,$2,$3,$4,$5,$6)',[
    story, time, req.user.username, id, [], type 
  ])
res.json('Successfully Uploaded')
    
  } catch (error) {
    res.json('Technical Error')
  }
} else {
res.json('Login First')
}
})


// for single post
app.get("/api/post/:id", async (req, res) => {
  try {
    let result = await db.query("SELECT * FROM instapost WHERE id = $1", [
      req.params.id,
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    res.json(error);
  }
});

app.get("/api/reel/:id", async (req, res) => {
  try {
    let result = await db.query("SELECT * FROM instareels WHERE id = $1", [
      req.params.id,
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    console.log(error);
    res.json(error);
  }
});


//like post
app.get('/api/like/:id',authenticateUser,async(req,res)=>{
 let id = req.params.id
 if (req.user) {
try {
    await db.query('UPDATE instapost SET likes = ARRAY_APPEND(likes,$1) WHERE id = $2',[req.user.username,id]) 
} catch (error) {
  console.log(error);
} 
res.json(true)

 } else {
  res.json(false)
 }
})
//dislike
app.get('/api/dislike/:id',authenticateUser,async(req,res)=>{
 let id = req.params.id
 if (req.user) {
try {
    await db.query('UPDATE instapost SET likes = ARRAY_REMOVE(likes,$1) WHERE id = $2',[req.user.username,id]) 
} catch (error) {
  console.log(error);
} 
res.json(false)

 } else {
  res.json(false)
 }
})

// comment
app.post("/api/addcomment/:id",authenticateUser, async (req, res) => {
  
  if (req.user) {
  let id = req.params.id;
  let comment = {
    username: req.user.username,
    addcmt: req.body.addcmt,
  };
    try {
      await db.query(
        "UPDATE instapost SET comments = ARRAY_APPEND(comments,$1) WHERE id = $2",
        [comment, id]
      );
      res.json("success");
    } catch (error) {
      console.log(error);
    }
  } else {
    res.json("log in first")
  }
});

//like post
app.get('/api/likeReel/:id',authenticateUser,async(req,res)=>{
  let id = req.params.id
  if (req.user) {
 try {
     await db.query('UPDATE instaReels SET likes = ARRAY_APPEND(likes,$1) WHERE id = $2',[req.user.username,id]) 
 } catch (error) {
   console.log(error);
 } 
 res.json(true)
 
  } else {
   res.json(false)
  }
 })
 //dislike
 app.get('/api/dislikeReel/:id',authenticateUser,async(req,res)=>{
  let id = req.params.id
  if (req.user) {
 try {
     await db.query('UPDATE instareels SET likes = ARRAY_REMOVE(likes,$1) WHERE id = $2',[req.user.username,id]) 
 } catch (error) {
   console.log(error);
 } 
 res.json(false)
 
  } else {
   res.json(false)
  }
 })
 
 // comment
 app.post("/api/addcommentReel/:id",authenticateUser, async (req, res) => {
  if (req.user) {
  let id = req.params.id;
  let comment = {
    username: req.user.username,
    addcmt: req.body.addcmt,
  };
    try {
      await db.query(
        "UPDATE instareels SET comments = ARRAY_APPEND(comments,$1) WHERE id = $2",
        [comment, id]
      );
      res.json("success");
    } catch (error) {
      console.log(error);
    }
  } else {
    res.json("log in first")
  }
 });
 



//for follow unfollow
app.post("/api/follow",authenticateUser, async (req, res) => {
  let { user } = req.body;
  if (req.user && req.user.username != user) {
    await db.query(
      "UPDATE userdata SET followers = ARRAY_APPEND(followers,$1) WHERE username = $2",
      [req.user.username, user]
    );
    await db.query(
      "UPDATE userdata SET following = ARRAY_APPEND(following,$1) WHERE username = $2",
      [user, req.user.username]
    );
    res.json("followed");
  } else {
    res.json("req failed");
  }
});

app.post("/api/unfollow",authenticateUser, async (req, res) => {
  let { user } = req.body;
  if (req.user && req.user.username != user) {
    await db.query(
      "UPDATE userdata SET followers = ARRAY_REMOVE(followers,$1) WHERE username = $2",
      [req.user.username, user]
    );
    await db.query(
      "UPDATE userdata SET following = ARRAY_REMOVE(following,$1) WHERE username = $2",
      [user, req.user.username]
    );
    res.json("unfollowed");
  } else {
    res.json("req failed");
  }
});



// for register
app.post("/api/register", async (req, res) => {
  let { username, password, OTP } = req.body;
if (OTP == emailOtp) {
  
    try {
      const result = await db.query("SELECT * FROM users WHERE username = $1", [
        username,
      ]);
      const mail = await db.query("SELECT * FROM users WHERE email = $1", [
        registeredEmail,
      ]);
  
      if (result.rows.length === 0) {
        if (mail.rows.length === 0) {
          bcrypt.hash(password, saltRound, async (err, hash) => {
            if (err) {
              res.json("Technical Error");
            } else {
              await db.query(
                "INSERT INTO users(username,password,email) VALUES($1, $2, $3)",
                [username.toLowerCase().trim(), hash, registeredEmail.toLowerCase().trim()]
              );
              await db.query(
                "INSERT INTO userdata(username,fname,lname) VALUES($1, $1, '')",
                [username.toLowerCase().trim()]
              );
            }
          });
          res.json("USER CREATED");
        } else {
          res.json("Email already registered");
        }
      } else {
        res.json("USER ALREADY EXIST");
      }
    } catch (error) {
      res.json(error);
    }
} else {
  res.json('Wrong OTP')
}
});

// to genrate email otp
app.post('/api/emailRegistration',(req,res)=>{
  emailOtp = Math.round(1000+Math.random()*9000)
  registeredEmail = req.body.email
  SendMail(emailOtp , registeredEmail)
  res.json(true)
})


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Internal Server Error');
});


app.get('*',(req,res)=>{
  res.send("created by Tushar")
})

app.listen(port, () => {
  console.log(`Running on Port ${port}`);
});
