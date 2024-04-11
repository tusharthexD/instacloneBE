import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import cors from "cors";
import cookieParser from "cookie-parser";
import {SendMail} from './SendMail.js'
import multer from 'multer'
import ffmpeg from "fluent-ffmpeg";
import dotenv from 'dotenv'

const app = express();
const port = process.env.port || 3000;
dotenv.config()
const saltRound = 4;
let emailOtp = null
let registeredEmail = null

app.use(cors({
  origin: 'https://igclone-sepia.vercel.app',
  credentials: true // Allow credentials (e.g., cookies, authorization headers)
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

app.use(cookieParser());

app.use(
  session({
    secret: "TUSHAR",
    resave: false,
    saveUninitialized: true,
  })
);

app.get('/',(req,res)=>{
  res.send('Created by Tushar')
})

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const minute = 1000 * 60; //STORY LOGIC
const hour = minute * 60;

let hours = Math.round(Date.now() / hour);

// Multer configuration for file upload
const upload = multer({ dest: 'uploads/' });

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
  res.send(error)
 }
});






app.get("/api/", (req, res) => {
  if (req.session.user) {
    let { username, profile } = req.session.user;
    res.send({ isLoggedin: true, user: username, profile: profile });
  } else {
    res.json({ isLoggedin: false });
  }
});


app.post("/api/profile", async (req, res) => {
  const result = await db.query(
    "SELECT * FROM users join userdata as ud ON ud.username = users.username WHERE users.username = $1",
    [req.body.id]
  );

  let data = {
    user: result.rows[0],
    isFollowed: false,
    isLoggedin: false,
    myProfile: false,
  };
  if (result.rows.length > 0) {
       if (req.session.user) {
               data.isLoggedin = true;
                if (req.session.user.username == data.user.username) data.myProfile = true;
                  if (data.user.followers) {
                     let ress = data.user.followers.find(
                     (e) => e == req.session.user.username);
                     if(ress) data.isFollowed = true
                    }}
                      
      res.send(data)
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

app.get('/api/profile/edit',async (req,res)=>{
  if (req.session.user) {
    const result = await db.query(
    "SELECT * FROM users join userdata as ud ON ud.username = users.username WHERE users.username = $1",
    [req.session.user.username]
  )
    result.rows[0].password = undefined
    res.json(result.rows[0])
  } else {
    res.json(null)
  }
})
//update profile
app.post('/api/profile/edit',async (req,res)=>{
  let {profile,fname,lname,bio,website} = req.body
  if (req.session.user) {
   try {
     await db.query(
     "UPDATE users SET profile = $1 WHERE username = $2",
     [profile, req.session.user.username])
     await db.query(
     "UPDATE userdata SET fname = $1, lname = $2, bio = $3, website = $4 WHERE username = $5",
     [fname, lname,bio,website, req.session.user.username])
     res.json("Changes Saved")

   } catch (error) {
    console.log(error)
    res.json(error)
   }
  } else {
    res.json('cahnges failed')
  }
})


// for addpost
app.post("/api/addpost", async (req, res) => {
  let { id, username, post, caption } = req.body;
  let t = new Date();
  let time = t.getTime();
  try {
    await db.query(
      "INSERT INTO instapost(id,username,post,likes,caption,comments,time) values($1,$2,$3,$4,$5,$6,$7)",
      [id, req.session.user.username, post, [], caption, [], time]
    );
    res.send("success");
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});


// for add reel
app.post("/api/addreel", async (req, res) => {
  let { id, post, caption } = req.body;
  let t = new Date();
  let time = t.getTime();
  try {
    await db.query(
      "INSERT INTO instareels(id,username,post,likes,caption,comments,time) values($1,$2,$3,$4,$5,$6,$7)",
      [id, req.session.user.username, post, [], caption, [], time]
    );
    res.send("success");
  } catch (error) {
    console.log(error);
    res.send(error);
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
    res.send(true)
  } else {
    res.send(false)
  }
})

app.post('/api/resetpassword', async (req,res)=>{
const {password1, OTP} = req.body;
if (OTP == emailOtp) {
  
  try {
    bcrypt.hash(password1, saltRound, async (err, hash) => {
            if (err) {
              console.log(err);
              res.send(false)
            } else {
              await db.query(
                "UPDATE users SET password = $1 WHERE email = $2",
                [hash, registeredEmail]
              );
              res.send(true)
             
            }
          });
  
    } catch (error) {
      console.log('not working');
      res.send(false);
    }
}
else{
  res.send(false)
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
app.post('/api/uploadstory', async (req,res)=>{
const {story, id, type} = req.body
const time =  Math.round(Date.now() /10000)
if (req.session.user) {
  try {
    
  await db.query('INSERT INTO instastory(story,time,username,id,viewer,type) VALUES($1,$2,$3,$4,$5,$6)',[
    story, time, req.session.user.username, id, [], type 
  ])
res.send('Successfully Uploaded')
    
  } catch (error) {
    res.send('Technical Error')
  }
} else {
res.send('Login First')
}
})


// for single post
app.get("/api/post/:id", async (req, res) => {
  try {
    let result = await db.query("SELECT * FROM instapost WHERE id = $1", [
      req.params.id,
    ]);
    res.send(result.rows[0]);
  } catch (error) {
    res.send(error);
  }
});

app.get("/api/reel/:id", async (req, res) => {
  try {
    let result = await db.query("SELECT * FROM instareels WHERE id = $1", [
      req.params.id,
    ]);
    res.send(result.rows[0]);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});


//like post
app.get('/api/like/:id',async(req,res)=>{
 let id = req.params.id
 if (req.session.user) {
try {
    await db.query('UPDATE instapost SET likes = ARRAY_APPEND(likes,$1) WHERE id = $2',[req.session.user.username,id]) 
} catch (error) {
  console.log(error);
} 
res.json(true)

 } else {
  res.json(false)
 }
})
//dislike
app.get('/api/dislike/:id',async(req,res)=>{
 let id = req.params.id
 if (req.session.user) {
try {
    await db.query('UPDATE instapost SET likes = ARRAY_REMOVE(likes,$1) WHERE id = $2',[req.session.user.username,id]) 
} catch (error) {
  console.log(error);
} 
res.json(false)

 } else {
  res.json(false)
 }
})

// comment
app.post("/api/addcomment/:id", async (req, res) => {
  
  if (req.session.user) {
  let id = req.params.id;
  let comment = {
    username: req.session.user.username,
    addcmt: req.body.addcmt,
  };
    try {
      await db.query(
        "UPDATE instapost SET comments = ARRAY_APPEND(comments,$1) WHERE id = $2",
        [comment, id]
      );
      res.send("success");
    } catch (error) {
      console.log(error);
    }
  } else {
    res.send("log in first")
  }
});

//like post
app.get('/api/likeReel/:id',async(req,res)=>{
  let id = req.params.id
  if (req.session.user) {
 try {
     await db.query('UPDATE instaReels SET likes = ARRAY_APPEND(likes,$1) WHERE id = $2',[req.session.user.username,id]) 
 } catch (error) {
   console.log(error);
 } 
 res.json(true)
 
  } else {
   res.json(false)
  }
 })
 //dislike
 app.get('/api/dislikeReel/:id',async(req,res)=>{
  let id = req.params.id
  if (req.session.user) {
 try {
     await db.query('UPDATE instareels SET likes = ARRAY_REMOVE(likes,$1) WHERE id = $2',[req.session.user.username,id]) 
 } catch (error) {
   console.log(error);
 } 
 res.json(false)
 
  } else {
   res.json(false)
  }
 })
 
 // comment
 app.post("/api/addcommentReel/:id", async (req, res) => {
  if (req.session.user) {
  let id = req.params.id;
  let comment = {
    username: req.session.user.username,
    addcmt: req.body.addcmt,
  };
    try {
      await db.query(
        "UPDATE instareels SET comments = ARRAY_APPEND(comments,$1) WHERE id = $2",
        [comment, id]
      );
      res.send("success");
    } catch (error) {
      console.log(error);
    }
  } else {
    res.send("log in first")
  }
 });
 



//for follow unfollow
app.post("/api/follow", async (req, res) => {
  let { user } = req.body;
  if (req.session.user && req.session.user.username != user) {
    await db.query(
      "UPDATE userdata SET followers = ARRAY_APPEND(followers,$1) WHERE username = $2",
      [req.session.user.username, user]
    );
    await db.query(
      "UPDATE userdata SET following = ARRAY_APPEND(following,$1) WHERE username = $2",
      [user, req.session.user.username]
    );
    res.json("followed");
  } else {
    res.json("req failed");
  }
});

app.post("/api/unfollow", async (req, res) => {
  let { user } = req.body;
  if (req.session.user && req.session.user.username != user) {
    await db.query(
      "UPDATE userdata SET followers = ARRAY_REMOVE(followers,$1) WHERE username = $2",
      [req.session.user.username, user]
    );
    await db.query(
      "UPDATE userdata SET following = ARRAY_REMOVE(following,$1) WHERE username = $2",
      [user, req.session.user.username]
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
  res.send(true)
})


// for login
app.post("/api/login", async (req, res) => {
  console.log('i am calling');
  const { username, password } = req.body;
  try {
    const result = await db.query("SELECT * FROM users WHERE username = $1", [
      username.toLowerCase(),
    ]);
    let loginPsw = result.rows[0].password;

    if (result.rows.length > 0) {
      bcrypt.compare(password, loginPsw, (err, valid) => {
        if (valid) {
          req.session.user = result.rows[0];
          res.json({
            isLoggedin: true,
            message:
              "You're Logged in",
          });
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



// for logout
app.get("/api/logout", (req, res) => {
  req.session.user = null;
  res.json({ isLoggedin: false });
});


app.listen(port, () => {
  console.log(`Running on Port ${port}`);
});
