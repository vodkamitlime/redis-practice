const express = require('express');
const axios = require('axios');
const cors = require('cors');
const Redis = require('redis');

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

app.listen(3001, () => console.log('Listening on port 3001'))