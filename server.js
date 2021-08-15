const express = require('express');
const axios = require('axios');
const cors = require('cors');
const Redis = require('redis');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
iconv.skipDecodeWarning = true

const session = require('express-session')
let RedisStore = require('connect-redis')(session)

const redisClient = new Redis.createClient(); // use default parameters or use url (localhost === default)
const DEFAULT_EXPIRATION = 3600 //seconds 

const app = express()
app.use(cors())

// use redis for session store 
app.use(session({
    secret: "secret",
    saveUninitialized: false,
    resave: false,
    store: new RedisStore(redisClient)
}))

// let store = new RedisStore({ client: redisClient })

// // get all photos from api
// app.get('/photos', async(req, res) => {
//     const albumId = req.query.albumId
//     const {data} = await axios.get(
//         'https://jsonplaceholder.typicode.com/photos',
//         {params : {albumId}},
//         )
//     res.json(data)
// })

// // check if redis server has data, if not get from api, store in redis and return
// app.get('/photos', async(req, res) => {
//     const albumId = req.query.albumId
//     redisClient.get('photos', async (err, data) => { // check data from redis server 
//         if (err) console.error(error)
//         if (data) {
//             res.json(JSON.parse(data)) // cache hit
//         } else {  // cache miss 
//             const {data} = await axios.get(
//                 'https://jsonplaceholder.typicode.com/photos',
//                 {params : {albumId}},
//                 )
//             redisClient.setex('photos', DEFAULT_EXPIRATION, JSON.stringify(data)) // set with an expiration time (or can use other redis expressions
//             // redis can only store strings, so we need to convert the data to a string        
//             res.json(data)
//         }
//     })
///})

// on first request, data is retrieved from api server (1200ms)
// on second + request, data is retrieved from redis server (20ms)
// if i set cache with individual id, response speeds up even more 
// ex setex('photos?albumId={albumID}'....)



// make a function to store cache if there isn't already one
function getorSetCache(key, callback) {
    return new Promise((resolve, reject) => {
        redisClient.get(key, async (err, data) => {
            if(err) return reject(err)
            if(data) return resolve(JSON.parse(data))
            const freshestData = await callback()
            redisClient.setex(key, DEFAULT_EXPIRATION, JSON.stringify(freshestData))
            resolve(freshestData)
        })
    })
}

// use function to get cache & send callback using axios for db/api 
app.get('/photos', async(req, res) => {
    const photos = await getorSetCache(`photos`, async () => {
        const {data} = await axios.get(
            'https://jsonplaceholder.typicode.com/photos',
            )
            return data
        })
    res.json(photos)
})


// get individual photo
app.get('/photos/:id', async(req, res) => {
    const id = req.params.id;
    const photo = await getorSetCache(`photo:${id}`, async () => {
        const {data} = await axios.get(
            'https://jsonplaceholder.typicode.com/photos/' + id,
        )
        return data;
    })
    res.json(photo)
})

// 보안뉴스 크롤링 함수 

const getSecurity = async () => {

    let articles = [];

    let CRAWL_URL = `https://www.boannews.com/media/t_list.asp`
    const html = await axios.get(CRAWL_URL, {
        responseEncoding: 'binary'
    });
    const htmlData = iconv.decode(html.data, 'euc-kr').toString();
    const $ = cheerio.load(htmlData);

    for (let i=0; i<=5; i++){
        const article = $('.news_list')[i]
        const url = $(article).find('a').attr('href')
        const title = $(article).find('.news_txt').text();
        const content = $(article).find('.news_content').text();
        const date = $(article).find('.news_writer').text();
        let DATA = {
            "article_title": title,
            "article_content": content,
            "article_date": date.split('| ')[1],
            "article_url": 'https://www.boannews.com/' + url, 
            "article_keyword": "보안"
        }
        articles.push(DATA); 
    }
    return articles;
}

// Practice with crawling code 
app.get('/crawl', async(req, res) => {
    redisClient.get('articles', async (err, data) => { // check data from redis server 
        if (err) console.error(error)
        if (data) {
            console.log(JSON.parse(data))
            res.json('cache hit!') 
        } else { 
            getSecurity().then(data => {
                redisClient.setex('articles', 10, JSON.stringify(data))
                console.log(data)
                res.json('cache miss!')
            })
        }
    })
})

// practice write-back method 
app.get('/writeback', async(req, res) => {

    let num = await redisClient.incr('hit')
    redisClient.get('hit', async (err, data) => {
        if (err) console.error(error)
        if (!data) {
            res.send('no cache')
        }
        if (data) {
            res.send(data)
        }
    })
})
// increment hit every time get request received, then save to DB         

// practice write-through method
app.get('/writethrough/db', async(req, res) => {
    let number = parseInt(Math.random() * 100)
    console.log(`db key "temp" changed to ${number}!`)
    redisClient.set('temp', number)
    setTimeout(() => {
        return res.send(`db updated, new value stored is ${number}`)
    }, 500)
})

app.get('/writethrough/cache', async(req, res) => {

    redisClient.get('temp', async (err, data) => {
        if (err) console.error(error)
        if (!data) {
            res.send('no cache')
        }
        if (data) {
            res.send(data)
        }
    })
})
// update cache every time DB is updated

// Cache logic for hit update articles :
// every time Article is crawled -> Update DB -> Save cache
// Cache: make a hash that contains every article according to its id
// Whenever user visits article link, update DB & cache 
// Set TTL for Cache so it updates entire DB regularly


app.listen(3001, () => console.log('Listening on port 3001'))