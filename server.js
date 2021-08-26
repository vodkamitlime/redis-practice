const { getArticlesFromBoanNews } = require('./crawler')
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const redis = require('redis');
const session = require('express-session')
const RedisStore = require('connect-redis')(session)

const redisClient = new redis.createClient(); // use default parameters or use url (localhost === default)
const DEFAULT_EXPIRATION = 60 //seconds 
const app = express()

// use redis for session store 
app.use(session({
    secret: "secret",
    saveUninitialized: false,
    resave: false,
    store: new RedisStore(redisClient)
}))
app.use(cors())

// Practice 1) 
// 1. Check if redis server has data
// 2. If not, get data from api
// 3. Store data in redis and return data
app.get('/photos?:albumId', async(req, res) => {

    const albumId = req.query.albumId

    redisClient.get(`photo${albumId}`, async (err, result) => {  

        if (err) {
            console.error(error)
        }

        // cache hit
        if (result) {
            return res.json({
                "data": JSON.parse(result),
                "message": "Cache hit!",
                "source": "Cache"
            }) 
        } 

        // cache miss 
        const { data } = await axios.get('https://jsonplaceholder.typicode.com/photos',{
            params : { albumId }
        })

        redisClient.setex(`photo${albumId}`, DEFAULT_EXPIRATION, JSON.stringify(data)) 

        return res.json({
            data,
            "message": "Cache successfully saved!",
            "source": "API"
        })

    })

})

// Practice 2)
// 1. Make a function for checking & storing cache if null 
// 2. Use callback function to return data from API 
const getorSetCache = (key, callback) => {

    return new Promise((resolve, reject) => {

        redisClient.get(key, async (err, data) => {

            if (err) {
                return reject(err)
            }

            if (data) {
                return resolve(JSON.parse(data))
            }

            const freshestData = await callback();
            redisClient.setex(key, DEFAULT_EXPIRATION, JSON.stringify(freshestData))
            resolve(freshestData)
        })

    })

}

app.get('/photos', async(req, res) => {

    const photos = await getorSetCache(`photos`, async () => {

        const {data} = await axios.get('https://jsonplaceholder.typicode.com/photos')
        return data

    })

    return res.json({
        "data": photos,
        "message": "Data successfully retrieved!"
    })

})

app.get('/photos/:id', async(req, res) => {

    const id = req.params.id;

    const photo = await getorSetCache(`photo:${id}`, async () => {

        const {data} = await axios.get(`https://jsonplaceholder.typicode.com/photos/${id}`)
        return data;

    })
    
    return res.json({
        "data": photo,
        "message": "Data successfully retrieved!"
    })

})

// Practice 3)
// 1. Check Cache for articles
// 2. Cache miss => Run crawler => set cache
// 3. Cache hit => Return data from cache 
app.get('/crawl', async(req, res) => {

    redisClient.get('articles', async (err, data) => { 

        if (err) {
            console.error(error)
        }

        if (data) {
            return res.json({
                "data": JSON.parse(data),
                "message": "Cache hit!",
            }) 
        } else { 
            getArticlesFromBoanNews().then(data => {

                redisClient.setex('articles', 10, JSON.stringify(data))
                return res.json({
                    "data": data,
                    "message": "Cache miss!"
                })
            })
        }
    })
})

// Practice 4) Write-back method 
// Whenever request is made, make changes to cache
// Save cache to DB after a while
app.get('/writeback', async(req, res) => {

    redisClient.get('hit', async (err, data) => {

        if (err) {
            console.error(error)
        }

        if (!data) {
            redisClient.setex('hit', 60 * 60, '1')
            return res.send('Cache set to 1!')
        }
        
        redisClient.incr('hit')
        console.log('Increment 1 at DB')

        if (Number(data) % 10 === 0) {
            console.log('Save cache to DB')
            return res.send(`Cache saved to DB at hit: ${data}`)
        }

        return res.send(`Cache incremented! Current hit at: ${data}`)

    })

})
    
// Practice 5) Write-through method
// Whenever request is made, make changes to cache & DB 
app.get('/writethrough', async(req, res) => {

    let number = parseInt(Math.random() * 100)
    console.log(`db key "temp" changed to ${number}!`)
    redisClient.set('temp', number)

    setTimeout(() => {
        return res.send(`DB & cache updated, new value stored is ${number}`)
    }, 500)

})

// Practice 6) Make promises with redis commands
const checkCacheForArticles = () => {
    
    return new Promise((resolve, reject) => {
        
        redisClient.hgetall('recentArticles', (err, articles) => {
        
            if (err) {
                reject(err);
            }

            // cache miss
            if (!articles) { 
                resolve('no cache');  
            }

            // cache hit
            if (articles) { 
                resolve('cache');
            }

        });

    })

}

app.listen(3001, () => console.log('Listening on port 3001'))