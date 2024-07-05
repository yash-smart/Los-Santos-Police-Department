import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv"
import bcrypt from "bcrypt";
import session from "express-session";
import cookieParser from "cookie-parser";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// const upload = multer({ dest: 'uploads/' })
env.config();

const app = express();
const port = 3000;

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "los-santos-police-department",
    password: process.env.DB_PASSWORD,
    port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    rolling: true,
    cookie: {
        secure: false,
        maxAge: 3600000
    } // Set secure to true in production with HTTPS
}));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './uploads')
    },
    filename: async function (req, file, cb) {
        console.log(file);
        if (file.fieldname == 'image') {
            let max = await db.query('select max(number) max from newselements;');
            max = max.rows[0].max+1;
            // let order_number = await db.query('select max(order_number) max from newselements where news_id=$1;',[req.params.news_id]);
            let extension = file.originalname.split('.');
            extension = extension[extension.length-1]
            // await db.query('insert into newselements values($1,\'image\',$2,null,$3,$4,$5)',[req.params.news_id,order_number.rows[0].max+1,req.body.caption,''+max+'.'+extension,max]);
            return cb(null,''+max+'.'+extension); 
        } else if (file.fieldname == 'video') {
            console.log(req.body);
            let max = await db.query('select max(number) max from newselements;');
            max = max.rows[0].max+1;
            // let order_number = await db.query('select max(order_number) max from newselements where news_id=$1;',[req.params.news_id]);
            let extension = file.originalname.split('.');
            extension = extension[extension.length-1]
            // await db.query('insert into newselements values($1,\'video\',$2,null,$3,$4,$5)',[req.params.news_id,order_number.rows[0].max+1,req.body.caption,''+max+'.'+extension,max]);
            return cb(null,''+max+'.'+extension); 
        }
    }
  })
  
  const upload = multer({ storage: storage })

app.get("/",(req,res) => {
    res.render('main.ejs')
})

app.get("/login", (req, res) => {
    if (req.session.user === undefined) {
        res.render("login.ejs")
    } else {
        res.redirect('/');
    }
})

app.post('/login', async (req, res) => {
    try {
        let user_data = await db.query('select * from users where username=$1;', [req.body.Username.trim()]);
        if (user_data.rows.length > 0) {
            let correct_password = user_data.rows[0].password;
            bcrypt.compare(req.body.Password, correct_password, function (err, result) {
                if (result) {
                    req.session.user = user_data.rows[0].id;
                    res.redirect('/');
                } else {
                    res.render('login.ejs', { message: 'Invalid Password.' })
                }
            });
        } else {
            res.render('login.ejs', { message: 'User doesn\'t exists.' })
        }
    } catch (err) {
        console.log(err)
        res.render('login.ejs', { message: 'Something went wrong. Try again.' })
    }
})

app.get('/register', (req, res) => {
    if (req.session.user == undefined) {
        res.render('register.ejs')
    } else {
        res.redirect('/')
    }
})

app.post('/register', async (req, res) => {
    try {
        let user_exist_data = await db.query('select * from users where username=$1;', [req.body.Username.trim()]);
        if (user_exist_data.rows.length > 0) {
            res.render('register.ejs', { message: 'User already exists.' })
        } else {
            bcrypt.hash(req.body.Password, 10, async function (err, hash) {
                try {
                    await db.query('insert into users(username,password,type) values($1,$2,$3);', [req.body.Username.trim(), hash, req.body.Type]);
                    res.redirect('/')
                } catch (err) {
                    res.render('register.ejs', { message: 'Something went wrong. Try again.' })
                    console.log(err)
                }
            });
        }
    } catch (err) {
        res.render('register.ejs', { message: 'Something went wrong. Try again.' })
        console.log(err)
    }
})

app.get('/news-announcements',async (req,res) => {
    let data = await db.query('select * from newsannouncements,newselements where newsannouncements.id=newselements.news_id and type=\'Heading\';');
    if (req.session.user) {
        let user_details = await db.query('select type from users where id=$1;',[req.session.user]);
        if (user_details.rows[0].type == 'Admin') {
            res.render('news-announcements.ejs',{admin:true,user_id:req.session.user,data:data.rows});
        } else {
            res.render('news-announcements.ejs',{admin:false,user_id:req.session.user,data:data.rows});
        }
    } else {
        res.send('Unauthorised');
    }
})

app.get('/news-announcements-add/:user_id',async (req,res) => {
    if (req.session.user == req.params.user_id) {
        let user_details = await db.query('select type from users where id=$1;',[req.params.user_id]);
        if (user_details.rows[0].type == 'Admin') {
            let news_id = await db.query('insert into newsannouncements(user_id,datetime) values($1,$2) RETURNING id,datetime;',[req.params.user_id,new Date()]);
            let posted_on = news_id.rows[0].datetime;
            news_id = news_id.rows[0].id;
            res.render('news-announcements-add.ejs',{news_id:news_id,new_news:true,user_id:req.params.user_id,posted_on:posted_on});
        } else {
            res.send('You are not authorised to view this page.');
        }
    } else {
        res.send('Unauthorised');
    }
})

app.post('/add-heading/:news_id/:user_id',async (req,res) => {
    await db.query('insert into newselements(news_id,type,order_number,text) values($1,$2,1,$3);',[req.params.news_id,'Heading',req.body.heading]);
    res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
})

app.get('/news-update/:news_id/:user_id',async (req,res)=> {
    let newselements = await db.query('select * from newselements where news_id=$1 order by order_number asc;',[req.params.news_id]);
    newselements = newselements.rows;
    let news_data = await db.query('select datetime from newsannouncements where id=$1;',[req.params.news_id]);
    let posted_on = news_data.rows[0].datetime;
    let likes = await db.query('select count(*) count from likes_news;');
    likes = likes.rows[0].count;
    if (newselements.length>0) {
        let likes = await db.query('select count(*) count from likes_news where news_id=$1;',[req.params.news_id]);
        likes = likes.rows[0].count;
        let comments_count = await db.query('select count(*) count from comments_news where news_id=$1;',[req.params.news_id]);
        comments_count = comments_count.rows[0].count;
        let comments = await db.query('select * from comments_news where news_id=$1 order by posted_on DESC;',[req.params.news_id]);
        comments = comments.rows;
        let users = [];
        for (let i=0;i<comments.length;i++) {
            let user_id = comments[i].user_id;
            let username = await db.query('select username from users where id=$1;',[user_id]);
            users.push(username.rows[0].username);
        }
        let like_data = await db.query('select * from likes_news where news_id=$1 and user_id=$2;',[req.params.news_id,req.session.user]);
        if (like_data.rows.length == 0) {
            res.render('news-announcements-add.ejs',{news_id:req.params.news_id,new_news:false,user_id:req.params.user_id,newselements:newselements,posted_on:posted_on,likes:likes,comments_count:comments_count,comments:comments,users,liked:false});
        } else {
            res.render('news-announcements-add.ejs',{news_id:req.params.news_id,new_news:false,user_id:req.params.user_id,newselements:newselements,posted_on:posted_on,likes:likes,comments_count:comments_count,comments:comments,users,liked:true});
        }
    } else {
        res.render('news-announcements-add.ejs',{news_id:req.params.news_id,new_news:true,user_id:req.params.user_id,posted_on:posted_on,likes:likes});
    }
})

app.post('/add-text/:news_id/:user_id',async (req,res) => {
    let order_number = await db.query('select max(order_number) max from newselements where news_id=$1;',[req.params.news_id]);
    order_number = order_number.rows[0].max;
    await db.query('insert into newselements values($1,\'text\',$2,$3,null);',[req.params.news_id,order_number+1,req.body.content]);
    res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
})

app.post('/add-image/:news_id/:user_id',upload.single('image'),async(req,res) => {
    let max = await db.query('select max(number) max from newselements;');
    max = max.rows[0].max+1;
    let order_number = await db.query('select max(order_number) max from newselements where news_id=$1;',[req.params.news_id]);
    let extension = req.file.originalname.split('.');
    extension = extension[extension.length-1]
    await db.query('insert into newselements values($1,\'image\',$2,null,$3,$4,$5)',[req.params.news_id,order_number.rows[0].max+1,req.body.caption,''+max+'.'+extension,max]);
    res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
})

app.get('/images/:img',(req,res) => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    res.sendFile(__dirname+'/uploads/'+req.params.img);
})

app.get('/delete/:news_id/:user_id/:order_number',async (req,res) => {
    let file_data = await db.query('select image_number,type from newselements where news_id=$1 and order_number=$2;',[req.params.news_id,req.params.order_number]);
    let type = file_data.rows[0].type;
    file_data = file_data.rows[0].image_number;
    if (type == 'image'||type=='video') {
        fs.unlink('./uploads/'+file_data,(err) => {
            if (err) {
                console.log(err)
            } else {
                console.log('File deleted successfully');
            }
        });
    }
    if (type == 'Heading') {
        await db.query('delete from newselements where news_id=$1',[req.params.news_id]);
        await db.query('delete from newsannouncements where id=$1;',[req.params.news_id]);
    } else {
        await db.query('delete from newselements where news_id=$1 and order_number=$2;',[req.params.news_id,req.params.order_number]);
    }
    res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
})

app.post('/add-video/:news_id/:user_id',upload.single('video'),async (req,res) => {
    // console.log(req.body);
    // await db.query()
    let max = await db.query('select max(number) max from newselements;');
    max = max.rows[0].max+1;
    let order_number = await db.query('select max(order_number) max from newselements where news_id=$1;',[req.params.news_id]);
    let extension = req.file.originalname.split('.');
    extension = extension[extension.length-1]
    await db.query('insert into newselements values($1,\'video\',$2,null,$3,$4,$5)',[req.params.news_id,order_number.rows[0].max+1,req.body.caption,''+max+'.'+extension,max]);
    res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
})

app.post('/update-heading/:news_id/:user_id/:order_number',async (req,res) => {
    await db.query('update newselements set text=$1 where news_id=$2 and order_number=$3;',[req.body.heading,req.params.news_id,req.params.order_number]);
    res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
})

app.post('/update-text/:news_id/:user_id/:order_number',async (req,res) => {
    db.query('update newselements set text=$1 where news_id=$2 and order_number=$3;',[req.body.content,req.params.news_id,req.params.order_number]);
    res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
})

app.post('/update-image/:news_id/:user_id/:order_number',upload.single('image'),async(req,res) => {
    let max = await db.query('select max(number) max from newselements;');
    max = max.rows[0].max+1;
    // let order_number = await db.query('select max(order_number) max from newselements where news_id=$1;',[req.params.news_id]);
    let extension = req.file.originalname.split('.');
    extension = extension[extension.length-1]
    let prev_path = await db.query('select image_number from newselements where news_id=$1 and order_number=$2;',[req.params.news_id,req.params.order_number]);
    prev_path = prev_path.rows[0].image_number;
    fs.unlink('./uploads/'+prev_path,(err)=> {
        if (err) {
            console.log(err)
        } else {
            console.log('File deleted successfully');
        }
    })
    await db.query('update newselements set image_number=$1,number=$2,caption=$5 where news_id=$3 and order_number=$4;',[''+max+'.'+extension,max,req.params.news_id,req.params.order_number,req.body.caption]);
    res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
})

app.post('/update-video/:news_id/:user_id/:order_number',upload.single('video'),async(req,res) => {
    let max = await db.query('select max(number) max from newselements;');
    max = max.rows[0].max+1;
    // let order_number = await db.query('select max(order_number) max from newselements where news_id=$1;',[req.params.news_id]);
    let extension = req.file.originalname.split('.');
    extension = extension[extension.length-1]
    let prev_path = await db.query('select image_number from newselements where news_id=$1 and order_number=$2;',[req.params.news_id,req.params.order_number]);
    prev_path = prev_path.rows[0].image_number;
    fs.unlink('./uploads/'+prev_path,(err)=> {
        if (err) {
            console.log(err)
        } else {
            console.log('File deleted successfully');
        }
    })
    await db.query('update newselements set image_number=$1,number=$2,caption=$5 where news_id=$3 and order_number=$4;',[''+max+'.'+extension,max,req.params.news_id,req.params.order_number,req.body.caption]);
    res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
})

app.get('/news/:news_id',async (req,res) => {
    let newselements = await db.query('select * from newselements where news_id=$1 order by order_number asc;',[req.params.news_id]);
    newselements = newselements.rows;
    let news_data = await db.query('select datetime from newsannouncements where id=$1;',[req.params.news_id]);
    let posted_on = news_data.rows[0].datetime;
    if (req.session.user) {
        let likes = await db.query('select count(*) count from likes_news where news_id=$1;',[req.params.news_id]);
        likes = likes.rows[0].count;
        let comments_count = await db.query('select count(*) count from comments_news where news_id=$1;',[req.params.news_id]);
        comments_count = comments_count.rows[0].count;
        let comments = await db.query('select * from comments_news where news_id=$1 order by posted_on DESC;',[req.params.news_id]);
        comments = comments.rows;
        let users = [];
        for (let i=0;i<comments.length;i++) {
            let user_id = comments[i].user_id;
            let username = await db.query('select username from users where id=$1;',[user_id]);
            users.push(username.rows[0].username);
        }
        let like_data = await db.query('select * from likes_news where news_id=$1 and user_id=$2;',[req.params.news_id,req.session.user]);
        if (like_data.rows.length == 0) {
            res.render('news-announcements-view.ejs',{newselements:newselements,posted_on:posted_on,logged_in:true,likes:likes,comments_count:comments_count,comments:comments,users,news_id:req.params.news_id,liked:false});
        } else {
            res.render('news-announcements-view.ejs',{newselements:newselements,posted_on:posted_on,logged_in:true,likes:likes,comments_count:comments_count,comments:comments,users,news_id:req.params.news_id,liked:true});
        }
    } else{
        res.send('Unauthorised');
    }
})

app.get('/like/:news_id',async (req,res) => {
    if (req.session.user) {
        let like_data = await db.query('select * from likes_news where news_id=$1 and user_id=$2;',[req.params.news_id,req.session.user]);
        if (like_data.rows.length == 0) {
            await db.query('insert into likes_news(news_id,user_id) values($1,$2);',[req.params.news_id,req.session.user]);
        }
        res.redirect('/news/'+req.params.news_id);
    } else {
        res.send('Unauthorised');
    }
})

app.get('/unlike/:news_id', async (req,res) => {
    if (req.session.user) {
        await db.query('delete from likes_news where news_id=$1 and user_id=$2;',[req.params.news_id,req.session.user]);
        res.redirect('/news/'+req.params.news_id);
    } else {
        res.send('Unauthorised');
    }
})

app.post('/comment/:news_id',async (req,res) => {
    if (req.session.user) {
        await db.query('insert into comments_news(news_id,user_id,text,posted_on) values($1,$2,$3,$4);',[req.params.news_id,req.session.user,req.body.comment,new Date()]);
        res.redirect('/news/'+req.params.news_id);
    } else {
        res.send('Unauthorised');
    }
})

app.get('/like-admin/:news_id',async (req,res) => {
    if (req.session.user) {
        let like_data = await db.query('select * from likes_news where news_id=$1 and user_id=$2;',[req.params.news_id,req.session.user]);
        if (like_data.rows.length == 0) {
            await db.query('insert into likes_news(news_id,user_id) values($1,$2);',[req.params.news_id,req.session.user]);
        }
        res.redirect('/news-update/'+req.params.news_id+'/'+req.session.user);
    } else {
        res.send('Unauthorised');
    }
})

app.get('/unlike-admin/:news_id', async (req,res) => {
    if (req.session.user) {
        await db.query('delete from likes_news where news_id=$1 and user_id=$2;',[req.params.news_id,req.session.user]);
        res.redirect('/news-update/'+req.params.news_id+'/'+req.session.user);
    } else {
        res.send('Unauthorised');
    }
})

app.post('/comment-admin/:news_id',async (req,res) => {
    if (req.session.user) {
        await db.query('insert into comments_news(news_id,user_id,text,posted_on) values($1,$2,$3,$4);',[req.params.news_id,req.session.user,req.body.comment,new Date()]);
        res.redirect('/news-update/'+req.params.news_id+'/'+req.session.user);
    } else {
        res.send('Unauthorised');
    }
})

app.listen(3000, () => {
    console.log(`Connected on localhost:3000`)
})