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
import nodemailer from "nodemailer";
import cloudinary from "cloudinary";
import { error } from "console";
import { createClient } from "@supabase/supabase-js";

let cloudinaryv2 = cloudinary.v2
import { CloudinaryStorage } from 'multer-storage-cloudinary';

async function getFileName(file) {
    let max1 = await db.query('select max(number) max from jobapplications;');
    max1 = max1.rows[0].max;
    let max2 = await db.query('select max(number) max from newselements;');
    max2 = max2.rows[0].max;
    let max3 = await db.query('select max(number) max from most_wanted;');
    max3 = max3.rows[0].max;
    let max4 = await db.query('select max(number) max from anonymous_tip;');
    max4 = max4.rows[0].max;
    let max = Math.max(max1,max2,max3,max4);
    max = max+1;
    // let order_number = await db.query('select max(order_number) max from newselements where news_id=$1;',[req.params.news_id]);
    let extension = file.originalname.split('.');
    extension = extension[extension.length-1]
    // await db.query('insert into newselements values($1,\'image\',$2,null,$3,$4,$5)',[req.params.news_id,order_number.rows[0].max+1,req.body.caption,''+max+'.'+extension,max]);
    return ''+max+'.'+extension; 
}

// const upload = multer({ dest: 'uploads/' })
env.config();

const app = express();
const port = process.env.PORT || 4000;

const transporter = nodemailer.createTransport({
    service:'gmail',
    auth: {
        user:'smartyash334@gmail.com',
        pass:process.env.EMAIL_PASSWORD
    }
})

const db = new pg.Client({
    connectionString:process.env.CONNECTION_STRING,
    ssl: {
        rejectUnauthorized: false,
    },
    family: 4
});
db.connect();

const server = http.createServer(app)

let newsclients = new Map();
let anonymous_tip_clients = [];

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
        } else if (data[0] == '5') {
            anonymous_tip_clients.push(ws);
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
        } else {
            for (let i=0;i<anonymous_tip_clients.length;i++) {
                if (anonymous_tip_clients[i] == ws) {
                    anonymous_tip_clients.splice(i,1);
                    console.log('Anonymous client deleted');
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
app.use(express.json())

cloudinaryv2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  
  const storage = new CloudinaryStorage({
    cloudinary: cloudinaryv2,
    params: async (req, file) => {
        let filename = await getFileName(file)
        console.log(filename); 
        console.log(file.mimetype);
        let resourceType;
        const mimeType = file.mimetype;
        if (mimeType.startsWith('image/')) {
            resourceType = 'image';
        } else if (mimeType.startsWith('video/')) {
            resourceType = 'video';
        } else if (mimeType === 'application/pdf') {
            resourceType = 'raw';
        } else {
            resourceType = 'raw';
        }
        return {
            folder:'uploads',
            public_id:filename,
            resource_type: resourceType,
        }
    }
  })
  const upload = multer({ storage: storage })
  const storage2 = multer.memoryStorage();
  const upload2 = multer({ storage: storage2 });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.get("/",async (req,res) => {
    if (req.session.user) {
        let user_details = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_details.rows[0].type;
        console.log(type);
        res.render('main.ejs',{logged:req.session.user,admin:type})
    } else {
        res.render('main.ejs',{logged:req.session.user});
    }
})

app.get("/login", (req, res) => {
    if (req.session.user === undefined) {
        res.render("auth/login.ejs")
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
                    res.render('auth/login.ejs', { message: 'Invalid Password.' })
                }
            });
        } else {
            res.render('auth/login.ejs', { message: 'User doesn\'t exists.' })
        }
    } catch (err) {
        console.log(err)
        res.render('auth/login.ejs', { message: 'Something went wrong. Try again.' })
    }
})

app.get('/register', (req, res) => {
    if (req.session.user == undefined) {
        res.render('auth/register.ejs')
    } else {
        res.redirect('/')
    }
})

app.post('/register', async (req, res) => {
    try {
        let user_exist_data = await db.query('select * from users where username=$1;', [req.body.Username.trim()]);
        if (user_exist_data.rows.length > 0) {
            res.render('auth/register.ejs', { message: 'User already exists.' })
        } else {
            bcrypt.hash(req.body.Password, 10, async function (err, hash) {
                try {
                    await db.query('insert into users(username,password,type) values($1,$2,$3);', [req.body.Username.trim(), hash, 'user']);
                    res.redirect('/')
                } catch (err) {
                    res.render('auth/register.ejs', { message: 'Something went wrong. Try again.' })
                    console.log(err)
                }
            });
        }
    } catch (err) {
        res.render('auth/register.ejs', { message: 'Something went wrong. Try again.' })
        console.log(err)
    }
})

app.get('/news-announcements',async (req,res) => {
    let data = await db.query('select * from newsannouncements,newselements where newsannouncements.id=newselements.news_id and type=\'Heading\' order by datetime desc;');
    if (req.session.user) {
        let user_details = await db.query('select type from users where id=$1;',[req.session.user]);
        let images_arr = [];
        for (let i=0;i<data.rows.length;i++) {
            let images = await db.query('select path from newselements where news_id=$1 and type=\'image\' order by order_number asc;',[data.rows[i].id]);
            if (images.rows.length>0) {
                images_arr.push(images.rows[0].path);
            } else {
                images_arr.push(null);
            }
        }
        if (user_details.rows[0].type == 'Admin') {
            res.render('news/news-announcements.ejs',{admin:true,user_id:req.session.user,data:data.rows,images_arr:images_arr,logged:req.session.user});
        } else {
            res.render('news/news-announcements.ejs',{admin:false,user_id:req.session.user,data:data.rows,images_arr:images_arr,logged:req.session.user});
        }
    } else {
        res.render("unauthorised.ejs");
    }
})

app.get('/news-announcements-add/:user_id',async (req,res) => {
    if (req.session.user == req.params.user_id) {
        let user_details = await db.query('select type from users where id=$1;',[req.params.user_id]);
        if (user_details.rows[0].type == 'Admin') {
            let news_id = await db.query('insert into newsannouncements(user_id,datetime) values($1,$2) RETURNING id,datetime;',[req.params.user_id,new Date()]);
            let posted_on = news_id.rows[0].datetime;
            news_id = news_id.rows[0].id;
            res.render('news/news-announcements-add.ejs',{news_id:news_id,new_news:true,user_id:req.params.user_id,posted_on:posted_on,logged:req.session.user,admin:user_details.rows[0].type});
        } else {
            res.send('You are not authorised to view this page.');
        }
    } else {
        res.render("unauthorised.ejs");
    }
})

app.post('/add-heading/:news_id/:user_id',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            await db.query('insert into newselements(news_id,type,order_number,text) values($1,$2,1,$3);',[req.params.news_id,'Heading',req.body.heading]);
            res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
        } else {
            res.render('unauthorised.ejs')
        }
    } else {
        res.render('unauthorised.ejs')
    }
})

app.get('/news-update/:news_id/:user_id',async (req,res)=> {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
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
                    res.render('news/news-announcements-add.ejs',{news_id:req.params.news_id,new_news:false,user_id:req.params.user_id,newselements:newselements,posted_on:posted_on,likes:likes,comments_count:comments_count,comments:comments,users,liked:false,logged:req.session.user,admin:true});
                } else {
                    res.render('news/news-announcements-add.ejs',{news_id:req.params.news_id,new_news:false,user_id:req.params.user_id,newselements:newselements,posted_on:posted_on,likes:likes,comments_count:comments_count,comments:comments,users,liked:true,logged:req.session.user,admin:true});
                }
            } else {
                res.render('news/news-announcements-add.ejs',{news_id:req.params.news_id,new_news:true,user_id:req.params.user_id,posted_on:posted_on,likes:likes,logged:req.session.user,admin:true});
            }
        } else {
            res.render('unauthorised.ejs')
        }
    } else {
        res.render('unauthorised.ejs')
    }
})

app.post('/add-text/:news_id/:user_id',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            let order_number = await db.query('select max(order_number) max from newselements where news_id=$1;',[req.params.news_id]);
            order_number = order_number.rows[0].max;
            await db.query('insert into newselements values($1,\'text\',$2,$3,null);',[req.params.news_id,order_number+1,req.body.content]);
            res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
        } else {
            res.render('unauthorised.ejs');
        }
    } else {
        res.render('unauthorised.ejs');
    }
})

app.post('/add-image/:news_id/:user_id',upload.single('image'),async(req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            console.log('Test');
            let max1 = await db.query('select max(number) max from jobapplications;');
            max1 = max1.rows[0].max;
            let max2 = await db.query('select max(number) max from newselements;');
            max2 = max2.rows[0].max;
            let max3 = await db.query('select max(number) max from most_wanted;');
            max3 = max3.rows[0].max;
            let max4 = await db.query('select max(number) max from anonymous_tip;');
            max4 = max4.rows[0].max;
            let max = Math.max(max1,max2,max3,max4);
            max = max+1;
            let order_number = await db.query('select max(order_number) max from newselements where news_id=$1;',[req.params.news_id]);
            let extension = req.file.originalname.split('.');
            extension = extension[extension.length-1]
            await db.query('insert into newselements values($1,\'image\',$2,null,$3,$4,$5,$6)',[req.params.news_id,order_number.rows[0].max+1,req.body.caption,''+max+'.'+extension,max,req.file.path]);
            res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
        } else {
            res.render('unauthorised.ejs');
        }
    } else {
        res.render('unauthorised.ejs')
    }
})

app.get('/images/:img',(req,res) => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    res.sendFile(__dirname+'/uploads/'+req.params.img);
})

app.get('/delete/:news_id/:user_id/:order_number',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            let file_data = await db.query('select image_number,type from newselements where news_id=$1 and order_number=$2;',[req.params.news_id,req.params.order_number]);
            let type = file_data.rows[0].type;
            file_data = file_data.rows[0].image_number;
            if (type == 'image'||type=='video') {
                console.log(file_data);
                console.log('uploads/'+file_data)
                if (type == 'image') {
                    cloudinaryv2.uploader.destroy('uploads/'+file_data,(err,result)=> {
                        if (err) {
                            console.log(err)
                        } else {
                            console.log('File deleted successfully:'+result)
                        }
                    })
                } else {
                    cloudinaryv2.uploader.destroy('uploads/'+file_data,{resource_type:'video'},(err,result)=> {
                        if (err) {
                            console.log(err)
                        } else {
                            console.log('File deleted successfully:'+result)
                        }
                    })
                }
            }
            if (type == 'Heading') {
                await db.query('delete from newselements where news_id=$1',[req.params.news_id]);
                await db.query('delete from newsannouncements where id=$1;',[req.params.news_id]);
                res.redirect('/news-announcements');
            } else {
                await db.query('delete from newselements where news_id=$1 and order_number=$2;',[req.params.news_id,req.params.order_number]);
                res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
            }
        } else {
            res.render('unauthorised.ejs');
        }
    } else {
        res.render('unauthorised.ejs');
    }
})

app.post('/add-video/:news_id/:user_id',upload.single('video'),async (req,res) => {
    // console.log(req.body);
    // await db.query()
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            let max1 = await db.query('select max(number) max from jobapplications;');
            max1 = max1.rows[0].max;
            let max2 = await db.query('select max(number) max from newselements;');
            max2 = max2.rows[0].max;
            let max3 = await db.query('select max(number) max from most_wanted;');
            max3 = max3.rows[0].max;
            let max4 = await db.query('select max(number) max from anonymous_tip;');
            max4 = max4.rows[0].max;
            let max = Math.max(max1,max2,max3,max4);
            max = max+1;
            let order_number = await db.query('select max(order_number) max from newselements where news_id=$1;',[req.params.news_id]);
            let extension = req.file.originalname.split('.');
            extension = extension[extension.length-1]
            await db.query('insert into newselements values($1,\'video\',$2,null,$3,$4,$5,$6)',[req.params.news_id,order_number.rows[0].max+1,req.body.caption,''+max+'.'+extension,max,req.file.path]);
            res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
        } else {
            res.render('unauthorised.ejs');
        }
    } else {
        res.render('unuthorised.ejs');
    }
})

app.post('/update-heading/:news_id/:user_id/:order_number',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            await db.query('update newselements set text=$1 where news_id=$2 and order_number=$3;',[req.body.heading,req.params.news_id,req.params.order_number]);
            res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
        } else {
            res.render('unauthorised.ejs');
        }
    } else {
        res.render('unauthorised.ejs');
    }
})

app.post('/update-text/:news_id/:user_id/:order_number',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            db.query('update newselements set text=$1 where news_id=$2 and order_number=$3;',[req.body.content,req.params.news_id,req.params.order_number]);
            res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
        } else {
            res.render('unauthorised.ejs');
        }
    } else {
        res.render('unauthorised.ejs');
    }
})

app.post('/update-image/:news_id/:user_id/:order_number',upload.single('image'),async(req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            let max1 = await db.query('select max(number) max from jobapplications;');
            max1 = max1.rows[0].max;
            let max2 = await db.query('select max(number) max from newselements;');
            max2 = max2.rows[0].max;
            let max3 = await db.query('select max(number) max from most_wanted;');
            max3 = max3.rows[0].max;
            let max4 = await db.query('select max(number) max from anonymous_tip;');
            max4 = max4.rows[0].max;
            let max = Math.max(max1,max2,max3,max4);
            max = max+1;
            // let order_number = await db.query('select max(order_number) max from newselements where news_id=$1;',[req.params.news_id]);
            let extension = req.file.originalname.split('.');
            extension = extension[extension.length-1]
            let prev_path = await db.query('select image_number from newselements where news_id=$1 and order_number=$2;',[req.params.news_id,req.params.order_number]);
            prev_path = prev_path.rows[0].image_number;
            cloudinaryv2.uploader.destroy('uploads/'+prev_path,(err,result)=> {
                if (err) {
                    console.log(err)
                } else {
                    console.log('File deleted successfully:'+result)
                }
            })
            await db.query('update newselements set image_number=$1,number=$2,caption=$5,path=$6 where news_id=$3 and order_number=$4;',[''+max+'.'+extension,max,req.params.news_id,req.params.order_number,req.body.caption,req.file.path]);
            res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
        } else {
            res.render('unauthorised.ejs');
        }
    } else {
        res.render('unauthorised.ejs');
    }
})

app.post('/update-video/:news_id/:user_id/:order_number',upload.single('video'),async(req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            let max1 = await db.query('select max(number) max from jobapplications;');
            max1 = max1.rows[0].max;
            let max2 = await db.query('select max(number) max from newselements;');
            max2 = max2.rows[0].max;
            let max3 = await db.query('select max(number) max from most_wanted;');
            max3 = max3.rows[0].max;
            let max4 = await db.query('select max(number) max from anonymous_tip;');
            max4 = max4.rows[0].max;
            let max = Math.max(max1,max2,max3,max4);
            max = max+1;
            // let order_number = await db.query('select max(order_number) max from newselements where news_id=$1;',[req.params.news_id]);
            let extension = req.file.originalname.split('.');
            extension = extension[extension.length-1]
            let prev_path = await db.query('select image_number from newselements where news_id=$1 and order_number=$2;',[req.params.news_id,req.params.order_number]);
            prev_path = prev_path.rows[0].image_number;
            cloudinaryv2.uploader.destroy('uploads/'+prev_path,(err,result)=> {
                if (err) {
                    console.log(err)
                } else {
                    console.log('File deleted successfully:'+result)
                }
            })
            await db.query('update newselements set image_number=$1,number=$2,caption=$5,path=$6 where news_id=$3 and order_number=$4;',[''+max+'.'+extension,max,req.params.news_id,req.params.order_number,req.body.caption,req.file.path]);
            res.redirect('/news-update/'+req.params.news_id+'/'+req.params.user_id);
        } else {
            res.render('unauthorised.ejs');
        }
    } else {
        res.render('unauthorised.ejs');
    }
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
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        for (let i=0;i<comments.length;i++) {
            let user_id = comments[i].user_id;
            let username = await db.query('select username from users where id=$1;',[user_id]);
            users.push(username.rows[0].username);
        }
        let like_data = await db.query('select * from likes_news where news_id=$1 and user_id=$2;',[req.params.news_id,req.session.user]);
        if (like_data.rows.length == 0) {
            res.render('news/news-announcements-view.ejs',{newselements:newselements,posted_on:posted_on,logged_in:true,likes:likes,comments_count:comments_count,comments:comments,users,news_id:req.params.news_id,liked:false,logged:req.session.user,admin:type});
        } else {
            res.render('news/news-announcements-view.ejs',{newselements:newselements,posted_on:posted_on,logged_in:true,likes:likes,comments_count:comments_count,comments:comments,users,news_id:req.params.news_id,liked:true,logged:req.session.user,admin:type});
        }
    } else{
        res.render("unauthorised.ejs");
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
        res.render("unauthorised.ejs");
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
        res.render("unauthorised.ejs");
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
        res.render("unauthorised.ejs");
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
        res.render("unauthorised.ejs");
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
        res.render("unauthorised.ejs");
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
        res.render("unauthorised.ejs");
    }
})

app.get('/jobs',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            let data = await db.query('select * from jobpostings order by last_apply_date asc;');
            res.render('job/jobs-edit.ejs',{data:data.rows,logged:req.session.user,admin:type});
        } else {
            let data = await db.query('select * from jobpostings where last_apply_date>=$1 order by last_apply_date asc;',[new Date()]);
            res.render('job/jobs.ejs',{data:data.rows,logged:req.session.user,admin:type})
        }
    } else {
        res.render("unauthorised.ejs");
    }
})

app.get('/job-post',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            res.render('job/job-post.ejs');
        } else {
            res.send('You are not authorised to visit this page');
        }
    } else {
        res.render("unauthorised.ejs");
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
        res.render("unauthorised.ejs");
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
            res.render('job/jobs-edit.ejs',{data:data.rows,logged:req.session.user,admin:type})
        } else {
            res.render('job/jobs.ejs',{data:data.rows,logged:req.session.user,admin:type})
        }
    } else {
        res.render('unauthorised.ejs');
    }
})

app.get('/apply-job/:job_id',async (req,res) => {
    res.render('job/job-apply.ejs',{job_id:req.params.job_id});
})

app.post('/apply-job/:job_id',upload2.single('resume'),async(req,res) => {
    console.log(req.file);
    if (req.session.user) {
        try {
            let user_applications = await db.query('select * from jobapplications where job_id=$1 and user_id=$2;',[req.params.job_id,req.session.user]);
            if (user_applications.rows.length>0) {
                res.send('You have already applied');
            } else {
                let max1 = await db.query('select max(number) max from jobapplications;');
                max1 = max1.rows[0].max;
                let max2 = await db.query('select max(number) max from newselements;');
                max2 = max2.rows[0].max;
                let max3 = await db.query('select max(number) max from most_wanted;');
                max3 = max3.rows[0].max;
                let max4 = await db.query('select max(number) max from anonymous_tip;');
                max4 = max4.rows[0].max;
                let max = Math.max(max1,max2,max3,max4);
                // console.log(max);
                let extension = req.file.originalname.split('.');
                extension = extension[extension.length-1]
                // console.log(extension);
                const { originalname, buffer } = req.file;
                // console.log(req.file);
                // console.log( await supabase.auth.getUser());
                const { data, error } = await supabase.storage
                .from('uploads')
                .upload(`uploads/${''+(max+1)+'.'+extension}`, buffer, {
                cacheControl: '3600',
                upsert: false,
                contentType: req.file.mimetype
                });

                if (error) {
                    throw error;
                }
                console.log("data"+data.path);
                const { data:data2 } = supabase
                .storage
                .from('uploads')
                .getPublicUrl(data.path);

                console.log(data2);
                await db.query('insert into jobapplications(user_id,email,resume_filename,datetime,number,job_id,status,path) values($1,$2,$3,$4,$5,$6,\'applied\',$7);',[req.session.user,req.body.email,''+(max+1)+'.'+extension,new Date(),max+1,req.params.job_id,data2.publicUrl]);
                res.redirect('/')
            }
        } catch(err) {
            console.log(err);
            res.send('An Error occured. Try again later.');
        }
    } else {
        res.render("unauthorised.ejs");
    }
})

app.get('/applications/:job_id',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            let data = await db.query('select jobapplications.email,jobapplications.resume_filename,jobapplications.datetime,jobapplications.job_id,users.username,jobapplications.user_id,jobapplications.status,jobapplications.path from jobapplications,users where job_id=$1 and jobapplications.user_id=users.id;',[req.params.job_id]);
            res.render('job/applications.ejs',{data:data.rows,job_id:req.params.job_id});
        } else {
            res.send('You are not authorised to view this page')
        }
    } else {
        res.render("unauthorised.ejs");
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
                cloudinaryv2.uploader.destroy('uploads/'+resumes[i].resume_filename,(err,result)=> {
                    if (err) {
                        console.log(err)
                    } else {
                        console.log('File deleted successfully:'+result)
                    }
                })
            }
            await db.query('delete from jobapplications where job_id=$1;',[req.params.job_id]);
            await db.query('delete from jobpostings where id=$1;',[req.params.job_id]);
            res.redirect('/jobs')
        } else {
            res.render("unauthorised.ejs");
        }
    } else {
        res.render("unauthorised.ejs");
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
            res.render('mostWanted/most-wanted-edit.ejs',{data:data,logged:req.session.user,admin:type});
        } else {
            let data = await db.query('select * from most_wanted order by name;');
            data = data.rows;
            res.render('mostWanted/most-wanted.ejs',{data:data,logged:req.session.user,admin:type});
        }
    } else {
        let data = await db.query('select * from most_wanted order by name;');
        data = data.rows;
        res.render('mostWanted/most-wanted.ejs',{data:data,logged:req.session.user,admin:false});
    }
})

app.get('/post-wanted-list',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            res.render('mostWanted/most-wanted-list-post.ejs');
        } else {
            res.render("unauthorised.ejs");
        }
    } else {
        res.render("unauthorised.ejs");
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
                let max4 = await db.query('select max(number) max from anonymous_tip;');
                max4 = max4.rows[0].max;
                let max = Math.max(max1,max2,max3,max4);
                let extension = req.file.originalname.split('.');
                extension = extension[extension.length-1];
                await db.query('insert into most_wanted(name,alias,nationality,description,image,number,path) values($1,$2,$3,$4,$5,$6,$7);',[req.body.name,req.body.alias,req.body.nationality,req.body.description,''+(max+1)+'.'+extension,max+1,req.file.path]);
                res.redirect('/most-wanted-list');
            } else {
                await db.query('insert into most_wanted(name,alias,nationality,description,image,number) values($1,$2,$3,$4,$5,$6);',[req.body.name,req.body.alias,req.body.nationality,req.body.description,null,null]);
                res.redirect('/most-wanted-list');
            }
        } else {
            res.render("unauthorised.ejs");
        }
    } else {
        res.render("unauthorised.ejs");
    }
})

app.get('/delete-wanted/:id',async(req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            let filename = await db.query('select image from most_wanted where id=$1;',[req.params.id]);
            filename = filename.rows[0].image;
            cloudinaryv2.uploader.destroy('uploads/'+filename,(err,result)=> {
                if (err) {
                    console.log(err)
                } else {
                    console.log('File deleted successfully:'+result)
                }
            })
            await db.query('delete from most_wanted where id=$1;',[req.params.id]);
            res.redirect('/most-wanted-list');
        } else {
            res.render("unauthorised.ejs");
        }
    } else {
        res.render("unauthorised.ejs");
    }
})

app.get('/register-admin',(req,res) => {
    res.render('auth/register-admin.ejs');
})

app.post('/register-admin',async (req,res) => {
    if (req.session.user) {
        let user_details = await db.query('select * from users where id=$1;',[req.session.user]);
        if (user_details.rows[0].type == 'Admin') {
            try {
                let user_exist_data = await db.query('select * from users where username=$1;', [req.body.Username.trim()]);
                if (user_exist_data.rows.length > 0) {
                    res.render('auth/register-admin.ejs', { message: 'User already exists.' })
                } else {
                    bcrypt.hash(req.body.Password, 10, async function (err, hash) {
                        try {
                            await db.query('insert into users(username,password,type,email) values($1,$2,$3,$4);', [req.body.Username.trim(), hash, 'Admin',req.body.Email]);
                            res.redirect('/')
                        } catch (err) {
                            res.render('auth/register-admin.ejs', { message: 'Something went wrong. Try again.' })
                            console.log(err)
                        }
                    });
                }
            } catch (err) {
                res.render('auth/register-admin.ejs', { message: 'Something went wrong. Try again.' })
                console.log(err)
            }
        } else {
            res.render('unauthorised.ejs');
        }
    } else {
        res.render('unauthorised.ejs');
    }
})

app.post('/save-job', async (req, res) => {
    console.log(req.body);
    if (req.session.user) {
        const jobId = req.body.jobId;
        const userId = req.session.user;
        try {
            if (jobId) {
                await db.query('INSERT INTO saved_jobs (user_id, job_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;', [userId, jobId]);
                res.json({ success: true });
            } else {
                res.json({ success: false, error: 'Job ID is missing.' });
            }
        } catch (error) {
            console.error('Error saving job:', error);
            res.json({ success: false, error: 'Database error' });
        }
    } else {
        res.status(401).json({ success: false, error: 'Unauthorized'});
    }
});

app.get('/saved-jobs',async (req,res) => {
    if (req.session.user) {
        try {
            let savedJobs = await db.query(
                'SELECT jp.* FROM jobpostings jp INNER JOIN saved_jobs sj ON jp.id = sj.job_id WHERE sj.user_id = $1 and last_apply_date>=$2 ORDER BY jp.last_apply_date ASC;',
                [req.session.user,new Date()]
            );
            res.render('job/saved-jobs.ejs', { data: savedJobs.rows, logged: req.session.user });
        } catch (error) {
            console.error('Error fetching saved jobs:', error);
            res.status(500).send('Server error');
        }
    } else {
        res.render("unauthorised.ejs");
    }
})

app.get('/delete-saved-job/:job_id',async (req,res) => {
    if (req.session.user) {
        await db.query('delete from saved_jobs where job_id=$1 and user_id=$2;',[req.params.job_id,req.session.user]);
        res.redirect('/saved-jobs');
    } else {
        res.render('unauthorised.ejs');
    }
})

app.get('/anonymous-tip-send',(req,res) => {
    // if (req.session.user) {
    res.render('anonymousTip/anonymous-tip-send.ejs',{logged:req.session.user});
})

app.post('/post-anonymous-tip',upload2.single('tip-file'),async (req,res) => {
    let date = new Date();
    if (req.file) {
        let max1 = await db.query('select max(number) max from jobapplications;');
        max1 = max1.rows[0].max;
        let max2 = await db.query('select max(number) max from newselements;');
        max2 = max2.rows[0].max;
        let max3 = await db.query('select max(number) max from most_wanted;');
        max3 = max3.rows[0].max;
        let max4 = await db.query('select max(number) max from anonymous_tip;');
        max4 = max4.rows[0].max;
        let max = Math.max(max1,max2,max3,max4);
        let extension = req.file.originalname.split('.');
        extension = extension[extension.length-1]
        const { originalname, buffer } = req.file;
        const { data, error } = await supabase.storage
        .from('uploads')
        .upload(`uploads/${(max+1)+'.'+extension}`, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: req.file.mimetype,
        });

        if (error) {
            throw error;
        }

        const { data:data2 } = supabase
      .storage
      .from('uploads')
      .getPublicUrl(`uploads/${(max+1)+'.'+extension}`);

        await db.query('insert into anonymous_tip(tip,posted_on,file_name,number,path) values($1,$2,$3,$4,$5);',[req.body.tip,date,(max+1)+'.'+extension,max+1,data2.publicUrl]);
        for (let i=0;i<anonymous_tip_clients.length;i++) {
            anonymous_tip_clients[i].send('6'+JSON.stringify([req.body.tip,date,data2.publicUrl]));
        }
    } else {
        await db.query('insert into anonymous_tip(tip,posted_on) values($1,$2);',[req.body.tip,date]);
        for (let i=0;i<anonymous_tip_clients.length;i++) {
            anonymous_tip_clients[i].send('6'+JSON.stringify([req.body.tip,date]));
        }
    }
    let description = req.body.tip;
    let datetime = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    let emailText = `
Priority: High

Dear Admin,

We have received a new anonymous tip through the LSPD website. Please review the details below and take appropriate action.

Tip Details:

Received On: ${datetime}
Description:
${description}

This tip has been submitted anonymously. The submitter’s identity remains confidential as per our protocols.

Action Required:
1. Review the tip information carefully.
2. Determine the urgency and relevance of the tip.
3. Coordinate with the necessary departments for further investigation.
4. Log this tip in the internal database for future reference.

For any further inquiries or actions, please refer to the internal guidelines or contact the IT support team for technical assistance.

Thank you for your immediate attention to this matter. Together, we ensure the safety and security of Los Santos.

Best Regards,
LSPD Tip Coordination Team

Note: This is an automated message from the LSPD Anonymous Tip System. Do not reply directly to this email. For any follow-up actions, please use the internal communication channels.`
    let admins = await db.query('select email from users where type=\'Admin\' and email is not null;');
    admins = admins.rows;
    for (let i=0;i<admins.length;i++) {
        let mailOptions = {
            from:'smartyash334@gmail.com',
            to:admins[i].email,
            subject:'Urgent: New Anonymous Tip Received',
            text:emailText
        }
        transporter.sendMail(mailOptions,(error,info)=> {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent successfully');
            }
        });
    }
    res.redirect('/');
})

app.get('/anonymous-tips',async (req,res)=> {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            let anonymousTips = await db.query('select * from anonymous_tip order by posted_on desc;');
            anonymousTips = anonymousTips.rows;
            res.render('anonymousTip/anonymous-tips.ejs',{data:anonymousTips,logged:req.session.user});
        } else {
            res.render('unauthorised.ejs');
        }
    } else {
        res.render('unauthorised.ejs');
    }
})

app.get('/accept/:job_id/:user_id',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            await db.query('update jobapplications set status=\'accepted\' where job_id=$1 and user_id=$2;',[req.params.job_id,req.params.user_id]);
            res.redirect('/applications/'+req.params.job_id);
        } else {
            res.render('unauthorised.ejs');
        }
    } else {
        res.render('unauthorised.ejs');
    }
})

app.get('/decline/:job_id/:user_id',async (req,res) => {
    if (req.session.user) {
        let user_data = await db.query('select type from users where id=$1;',[req.session.user]);
        let type = user_data.rows[0].type;
        if (type == 'Admin') {
            await db.query('update jobapplications set status=\'declined\' where job_id=$1 and user_id=$2;',[req.params.job_id,req.params.user_id]);
            res.redirect('/applications/'+req.params.job_id);
        } else {
            res.render('unauthorised.ejs');
        }
    } else {
        res.render('unauthorised.ejs');
    }
})

app.get('/applied-jobs',async (req,res) => {
    if (req.session.user) {
        let data = await db.query('select * from jobapplications,jobpostings where user_id=$1 and jobpostings.id=jobapplications.job_id order by datetime desc;',[req.session.user]);
        res.render('job/your_jobs.ejs',{data:data.rows,logged:req.session.user});
    } else {
        res.render('unauthorised.ejs');
    }
})

server.listen(port, () => {
    console.log(`Connected on localhost:4000`)
})
