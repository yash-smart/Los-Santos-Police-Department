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
import http from "http";
import WebSocket,{WebSocketServer} from "ws";


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

const server = http.createServer(app)

let newsclients = new Map();

const wss = new WebSocketServer({server : server})

wss.on('error',console.error)

wss.on('listening',() => {
    console.log('Connected')
})

wss.on('connection', function connection(ws) {
    let id = null;
    ws.on('error', console.error);
    ws.on('message', async function message(data) {
        data = ''+data;
        console.log('Message Received: '+data);
        if (data[0] == '1') {
            id = data;
            if (newsclients.has(data.slice(1))) {
                let arr = newsclients.get(data.slice(1));
                arr.push(ws);
            } else {
                newsclients.set(data.slice(1),[ws]);
            }
        }
    });
    ws.on('close',() => {
        if (id) {
            let arr = newsclients.get(id.slice(1));
            for (let i=0;i<arr.length;i++) {
                if (arr[i] == ws) {
                    arr.splice(i,1);
                    console.log('Item Deleted');
                }
            }
        }
    });
});

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
            let max1 = await db.query('select max(number) max from jobapplications;');
            max1 = max1.rows[0].max;
            let max2 = await db.query('select max(number) max from newselements;');
            max2 = max2.rows[0].max;
            let max3 = await db.query('select max(number) max from most_wanted;');
            max3 = max3.rows[0].max;
            let max = Math.max(max1,max2,max3);
            max = max+1;
            // let order_number = await db.query('select max(order_number) max from newselements where news_id=$1;',[req.params.news_id]);
            let extension = file.originalname.split('.');
            extension = extension[extension.length-1]
            // await db.query('insert into newselements values($1,\'image\',$2,null,$3,$4,$5)',[req.params.news_id,order_number.rows[0].max+1,req.body.caption,''+max+'.'+extension,max]);
            return cb(null,''+max+'.'+extension); 
        } else if (file.fieldname == 'video') {
            console.log(req.body);
            let max1 = await db.query('select max(number) max from jobapplications;');
            max1 = max1.rows[0].max;
            let max2 = await db.query('select max(number) max from newselements;');
            max2 = max2.rows[0].max;
            let max3 = await db.query('select max(number) max from most_wanted;');
            max3 = max3.rows[0].max;
            let max = Math.max(max1,max2,max3);
            max = max+1;
            // let order_number = await db.query('select max(order_number) max from newselements where news_id=$1;',[req.params.news_id]);
            let extension = file.originalname.split('.');
            extension = extension[extension.length-1]
            // await db.query('insert into newselements values($1,\'video\',$2,null,$3,$4,$5)',[req.params.news_id,order_number.rows[0].max+1,req.body.caption,''+max+'.'+extension,max]);
            return cb(null,''+max+'.'+extension); 
        } else if (file.fieldname == 'resume') {
            let max1 = await db.query('select max(number) max from jobapplications;');
            max1 = max1.rows[0].max;
            let max2 = await db.query('select max(number) max from newselements;');
            max2 = max2.rows[0].max;
            let max3 = await db.query('select max(number) max from most_wanted;');
            max3 = max3.rows[0].max;
            let max = Math.max(max1,max2,max3);
            let extension = file.originalname.split('.');
            extension = extension[extension.length-1]
            return cb(null,''+(max+1)+'.'+extension);
        }
        if (file.fieldname == 'photo') {
            let max1 = await db.query('select max(number) max from jobapplications;');
            max1 = max1.rows[0].max;
            let max2 = await db.query('select max(number) max from newselements;');
            max2 = max2.rows[0].max;
            let max3 = await db.query('select max(number) max from most_wanted;');
            max3 = max3.rows[0].max;
            let max = Math.max(max1,max2,max3);
            let extension = file.originalname.split('.');
            extension = extension[extension.length-1]
            return cb(null,''+(max+1)+'.'+extension);
        }
    }
  })
  
  const upload = multer({ storage: storage })

app.get("/",(req,res) => {
    res.render('main.ejs',{logged:req.session.user})
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
    let data = await db.query('select * from newsannouncements,newselements where newsannouncements.id=newselements.news_id and type=\'Heading\' order by datetime desc;');
    if (req.session.user) {
        let user_details = await db.query('select type from users where id=$1;',[req.session.user]);
        let images_arr = [];
        for (let i=0;i<data.rows.length;i++) {
            let images = await db.query('select image_number from newselements where news_id=$1 and type=\'image\' order by order_number asc;',[data.rows[i].id]);
            if (images.rows.length>0) {
                images_arr.push(images.rows[0].image_number);
            } else {
                images_arr.push(null);
            }
        }
        if (user_details.rows[0].type == 'Admin') {
            res.render('news-announcements.ejs',{admin:true,user_id:req.session.user,data:data.rows,images_arr:images_arr});
        } else {
            res.render('news-announcements.ejs',{admin:false,user_id:req.session.user,data:data.rows,images_arr:images_arr});
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
    let max1 = await db.query('select max(number) max from jobapplications;');
    max1 = max1.rows[0].max;
    let max2 = await db.query('select max(number) max from newselements;');
    max2 = max2.rows[0].max;
    let max3 = await db.query('select max(number) max from most_wanted;');
    max3 = max3.rows[0].max;
    let max = Math.max(max1,max2,max3);
    max = max+1;
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
        res.redirect('/news-announcements');
    } else {
        await db.query('delete from newselements where news_id=$1 and order_number=$2;',[req.params.news_id,req.params.order_number]);
        res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
    }
})

app.post('/add-video/:news_id/:user_id',upload.single('video'),async (req,res) => {
    // console.log(req.body);
    // await db.query()
    let max1 = await db.query('select max(number) max from jobapplications;');
    max1 = max1.rows[0].max;
    let max2 = await db.query('select max(number) max from newselements;');
    max2 = max2.rows[0].max;
    let max3 = await db.query('select max(number) max from most_wanted;');
    max3 = max3.rows[0].max;
    let max = Math.max(max1,max2,max3);
    max = max+1;
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
    let max1 = await db.query('select max(number) max from jobapplications;');
    max1 = max1.rows[0].max;
    let max2 = await db.query('select max(number) max from newselements;');
    max2 = max2.rows[0].max;
    let max3 = await db.query('select max(number) max from most_wanted;');
    max3 = max3.rows[0].max;
    let max = Math.max(max1,max2,max3);
    max = max+1;
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
    let max1 = await db.query('select max(number) max from jobapplications;');
    max1 = max1.rows[0].max;
    let max2 = await db.query('select max(number) max from newselements;');
    max2 = max2.rows[0].max;
    let max3 = await db.query('select max(number) max from most_wanted;');
    max3 = max3.rows[0].max;
    let max = Math.max(max1,max2,max3);
    max = max+1;
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
            let clients = newsclients.get(req.params.news_id);
            if (clients) {
                for (let i=0;i<clients.length;i++) {
                    if (clients[i]) {
                        clients[i].send('3');
                    }
                }
            }
        }
        res.redirect('/news/'+req.params.news_id);
    } else {
        res.send('Unauthorised');
    }
})

app.get('/unlike/:news_id', async (req,res) => {
    if (req.session.user) {
        await db.query('delete from likes_news where news_id=$1 and user_id=$2;',[req.params.news_id,req.session.user]);
        let clients = newsclients.get(req.params.news_id);
        if (clients) {
            for (let i=0;i<clients.length;i++) {
                if (clients[i]) {
                    clients[i].send('2');
                }
            }
        }
        res.redirect('/news/'+req.params.news_id);
    } else {
        res.send('Unauthorised');
    }
})

app.post('/comment/:news_id',async (req,res) => {
    if (req.session.user) {
        let date = new Date();
        await db.query('insert into comments_news(news_id,user_id,text,posted_on) values($1,$2,$3,$4);',[req.params.news_id,req.session.user,req.body.comment,date]);
        let username = await db.query('select username from users where id=$1;',[req.session.user]);
        username = username.rows[0].username;
        let clients = newsclients.get(req.params.news_id);
        if (clients) {
            for (let i=0;i<clients.length;i++) {
                if (clients[i]) {
                    clients[i].send('4'+JSON.stringify([username,req.body.comment,date]));
                }
            }
        }
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
            let clients = newsclients.get(req.params.news_id);
            if (clients) {
                for (let i=0;i<clients.length;i++) {
                    if (clients[i]) {
                        clients[i].send('3');
                    }
                }
            }
        }
        res.redirect('/news-update/'+req.params.news_id+'/'+req.session.user);
    } else {
        res.send('Unauthorised');
    }
})

app.get('/unlike-admin/:news_id', async (req,res) => {
    if (req.session.user) {
        await db.query('delete from likes_news where news_id=$1 and user_id=$2;',[req.params.news_id,req.session.user]);
        let clients = newsclients.get(req.params.news_id);
        if (clients) {
            for (let i=0;i<clients.length;i++) {
                if (clients[i]) {
                    clients[i].send('2');
                }
            }
        }
        res.redirect('/news-update/'+req.params.news_id+'/'+req.session.user);
    } else {
        res.send('Unauthorised');
    }
})

app.post('/comment-admin/:news_id',async (req,res) => {
    if (req.session.user) {
        let date = new Date();
        await db.query('insert into comments_news(news_id,user_id,text,posted_on) values($1,$2,$3,$4);',[req.params.news_id,req.session.user,req.body.comment,date]);
        let username = await db.query('select username from users where id=$1;',[req.session.user]);
        username = username.rows[0].username;
        let clients = newsclients.get(req.params.news_id);
        if (clients) {
            for (let i=0;i<clients.length;i++) {
                if (clients[i]) {
                    clients[i].send('4'+JSON.stringify([username,req.body.comment,date]));
                }
            }
        }
        res.redirect('/news-update/'+req.params.news_id+'/'+req.session.user);
    } else {
        res.send('Unauthorised');
    }
})

app.get('/jobs',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            let data = await db.query('select * from jobpostings order by last_apply_date asc;');
            res.render('jobs-edit.ejs',{data:data.rows,logged:req.session.user});
        } else {
            let data = await db.query('select * from jobpostings where last_apply_date>=$1 order by last_apply_date asc;',[new Date()]);
            res.render('jobs.ejs',{data:data.rows,logged:req.session.user})
        }
    } else {
        res.send('Unauthorised');
    }
})

app.get('/job-post',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            res.render('job-post.ejs');
        } else {
            res.send('You are not authorised to visit this page');
        }
    } else {
        res.send('Unauthorised');
    }
})

app.post('/job-post',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            let request = req.body;
            console.log(request);
            await db.query('insert into jobpostings(title,description,department,location_type,location,type,last_apply_date,posted_on) values($1,$2,$3,$4,$5,$6,$7,$8);',[request.title,request.description,request.department,request.location_type,request.location,request.type,new Date(request.last_apply_date),new Date()]);
            res.redirect('/jobs');
        } else {
            res.send('You are not authorised to visit this page');
        }
    } else {
        res.send('Unauthorised');
    }
})

// app.post('/filter-job-edit',async (req,res)=> {
//     let filters = [];
//     if (req.body.filter) {
//       filters = req.body.filter;  
//     }
//     console.log(filters)
//     let filters_object = {'Title':false,'Description':false,'Department':false,'Location_type':false,'Location':false,'Type':false};
//     let data = await db.query('select * from jobpostings where last_apply_date>$1 order by last_apply_date asc;',[new Date()]);
//     for (let i=0;i<filters.length;i++) {
//         if (filters[i] == 'Location Type') {
//             console.log('True')
//             filters_object.Location_type = true;
//         } else {
//             filters_object[filters[i]] = true;
//         }
//     }
//     console.log(filters)
//     res.render('jobs-edit.ejs',{filters:filters_object,data:data.rows});
// })

app.post('/filter-job-post',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        console.log(req.body);
        let filters_object = {'Title':false,'Description':false,'Department':false,'Location_type':false,'Location':false,'Type':false};
        for (let key in req.body) {
            if (req.body[key] !== '' && req.body[key] !== 'None') {
                console.log(key);
                filters_object[key] = true;
            }
        }
        let filters_conditions = [];
        for (let key in filters_object) {
            if (filters_object[key] == true) {
                let push_value = null;
                if (key == 'Title' || key == 'Description' || key == 'Location') {
                    push_value = `lower(${key}) like lower(\'%${req.body[key]}%\')`;
                } else {
                    push_value = `${key} = \'${req.body[key]}\'`;
                }
                filters_conditions.push(push_value);
            }
        }
        const whereClause = filters_conditions.length>0?`where ${filters_conditions.join(' AND ')}`:'';
        console.log(whereClause)
        let query = null;
        let data = null;
        if (type == 'Admin') {
            query = whereClause!==''?'select * from jobpostings '+whereClause+' order by last_apply_date;':'select * from jobpostings '+whereClause+' order by last_apply_date;';    
            data = await db.query(query);
        } else {
            query = whereClause!==''?'select * from jobpostings '+whereClause+' and last_apply_date>$1 order by last_apply_date;':'select * from jobpostings '+whereClause+' where last_apply_date>=$1 order by last_apply_date;';
            data = await db.query(query,[new Date()]);
        }
        console.log(query);
        if (type == 'Admin') {
            res.render('jobs-edit.ejs',{data:data.rows,logged:req.session.user})
        } else {
            res.render('jobs.ejs',{data:data.rows,logged:req.session.user})
        }
    }
})

app.get('/apply-job/:job_id',async (req,res) => {
    res.render('job-apply.ejs',{job_id:req.params.job_id});
})

app.post('/apply-job/:job_id',upload.single('resume'),async(req,res) => {
    console.log(req.file);
    if (req.session.user) {
        try {
            let user_applications = await db.query('select * from jobapplications where job_id=$1 and user_id=$2;',[req.params.job_id,req.session.user]);
            if (user_applications.rows.length>0) {
                let max1 = await db.query('select max(number) max from jobapplications;');
                max1 = max1.rows[0].max;
                let max2 = await db.query('select max(number) max from newselements;');
                max2 = max2.rows[0].max;
                let max3 = await db.query('select max(number) max from most_wanted;');
                max3 = max3.rows[0].max;
                let max = Math.max(max1,max2,max3);
                let extension = req.file.originalname.split('.');
                extension = extension[extension.length-1]
                res.send('You have already applied');
                fs.unlink('./uploads/'+(max+1)+'.'+extension,(err) => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('File deleted successfully');
                    }
                })
            } else {
                let max1 = await db.query('select max(number) max from jobapplications;');
                max1 = max1.rows[0].max;
                let max2 = await db.query('select max(number) max from newselements;');
                max2 = max2.rows[0].max;
                let max3 = await db.query('select max(number) max from most_wanted;');
                max3 = max3.rows[0].max;
                let max = Math.max(max1,max2,max3);
                let extension = req.file.originalname.split('.');
                extension = extension[extension.length-1]
                await db.query('insert into jobapplications(user_id,email,resume_filename,datetime,number,job_id) values($1,$2,$3,$4,$5,$6);',[req.session.user,req.body.email,''+(max+1)+'.'+extension,new Date(),max+1,req.params.job_id]);
                res.redirect('/')
            }
        } catch(err) {
            console.log(err);
            res.send('An Error occured. Try again later.');
        }
    } else {
        res.send('Unauthorised');
    }
})

app.get('/applications/:job_id',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            let data = await db.query('select * from jobapplications,users where job_id=$1 and jobapplications.user_id=users.id;',[req.params.job_id]);
            res.render('applications.ejs',{data:data.rows});
        } else {
            res.send('You are not authorised to view this page')
        }
    } else {
        res.send('Unauthorised');
    }
})

app.get('/delete-job/:job_id',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            let resumes = await db.query('select resume_filename from jobapplications where job_id=$1;',[req.params.job_id]);
            resumes = resumes.rows;
            for (let i=0;i<resumes.length;i++) {
                fs.unlink('./uploads/'+resumes[i].resume_filename,(err) => {
                    if (err) {
                        console.log(err)
                    } else {
                        console.log('File deleted successfully');
                    }
                })
            }
            await db.query('delete from jobapplications where job_id=$1;',[req.params.job_id]);
            await db.query('delete from jobpostings where id=$1;',[req.params.job_id]);
            res.redirect('/jobs')
        } else {
            res.send('Unauthorised');
        }
    } else {
        res.send('Unauthorised');
    }
})

app.get('/logout',(req,res) => {
    req.session.destroy();
    // console.log(req.session.user)
    res.redirect('/');
})

app.get('/most-wanted-list',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            let data = await db.query('select * from most_wanted order by name;');
            data = data.rows;
            res.render('most-wanted-edit.ejs',{data:data});
        } else {
            let data = await db.query('select * from most_wanted order by name;');
            data = data.rows;
            res.render('most-wanted.ejs',{data:data});
        }
    } else {
        let data = await db.query('select * from most_wanted order by name;');
        data = data.rows;
        res.render('most-wanted.ejs',{data:data});
    }
})

app.get('/post-wanted-list',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            res.render('most-wanted-list-post.ejs');
        } else {
            res.send('Unauthorised');
        }
    } else {
        res.send('Unauthorised');
    }
})

app.post('/most-wanted-list-post',upload.single('photo'),async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            if (req.file) {
                let max1 = await db.query('select max(number) max from jobapplications;');
                max1 = max1.rows[0].max;
                let max2 = await db.query('select max(number) max from newselements;');
                max2 = max2.rows[0].max;
                let max3 = await db.query('select max(number) max from most_wanted;');
                max3 = max3.rows[0].max;
                let max = Math.max(max1,max2,max3);
                let extension = req.file.originalname.split('.');
                extension = extension[extension.length-1];
                await db.query('insert into most_wanted(name,alias,nationality,description,image,number) values($1,$2,$3,$4,$5,$6);',[req.body.name,req.body.alias,req.body.nationality,req.body.description,''+(max+1)+'.'+extension,max+1]);
                res.redirect('/most-wanted-list');
            } else {
                await db.query('insert into most_wanted(name,alias,nationality,description,image,number) values($1,$2,$3,$4,$5,$6);',[req.body.name,req.body.alias,req.body.nationality,req.body.description,null,null]);
                res.redirect('/most-wanted-list');
            }
        } else {
            res.send('Unauthorised');
        }
    } else {
        res.send('Unauthorised');
    }
})

app.get('/delete-wanted/:id',async(req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            let filename = await db.query('select image from most_wanted where id=$1;',[req.params.id]);
            filename = filename.rows[0].image;
            fs.unlink('./uploads/'+filename,(err) => {
                if (err) {
                    console.log(err);
                } else {
                    console.log('File deleted successfully');
                }
            })
            await db.query('delete from most_wanted where id=$1;',[req.params.id]);
            res.redirect('/most-wanted-list');
        } else {
            res.send('Unauthorised');
        }
    } else {
        res.send('Unauthorised');
    }
})

server.listen(4000, () => {
    console.log(`Connected on localhost:4000`)
})