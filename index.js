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


app.get("/", (req, res) => {
    if (req.session.user === undefined) {
        res.render("login.ejs")
    } else {
        res.redirect('/news-announcements/' + req.session.user);
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
                    res.redirect('/news-announcements/' + req.session.user);
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
        res.redirect('/news-announcements/' + req.session.user)
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

app.get('/news-announcements/:user_id',async (req,res) => {
    if (req.session.user == req.params.user_id) {
        let user_details = await db.query('select type from users where id=$1;',[req.params.user_id]);
        let data = await db.query('select * from newsannouncements,newselements where newsannouncements.id=newselements.news_id and type=\'Heading\';');
        if (user_details.rows[0].type == 'Admin') {
            res.render('news-announcements.ejs',{admin:true,user_id:req.params.user_id,data:data.rows});
        } else {
            res.render('news-announcements.ejs',{admin:false,user_id:req.params.user_id});
        }
    } else {
        res.send('Unauthorised');
    }
})

app.get('/news-announcements-add/:user_id',async (req,res) => {
    if (req.session.user == req.params.user_id) {
        let user_details = await db.query('select type from users where id=$1;',[req.params.user_id]);
        if (user_details.rows[0].type == 'Admin') {
            let news_id = await db.query('insert into newsannouncements(user_id) values($1) RETURNING id;',[req.params.user_id])
            news_id = news_id.rows[0].id;
            res.render('news-announcements-add.ejs',{news_id:news_id,new_news:true,user_id:req.params.user_id});
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
    if (newselements.length>0) {
        res.render('news-announcements-add.ejs',{news_id:req.params.news_id,new_news:false,user_id:req.params.user_id,newselements:newselements});
    } else {
        res.render('news-announcements-add.ejs',{news_id:req.params.news_id,new_news:true,user_id:req.params.user_id});
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

app.listen(3000, () => {
    console.log(`Connected on localhost:3000`)
})