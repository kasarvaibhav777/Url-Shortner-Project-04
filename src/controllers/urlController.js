const shortid = require("shortid");
const urlModel = require("../models/urlModel");
const redis = require("redis");
const { promisify } = require("util");
const axios=require('axios')

//------------------------------------redis config-----------------------------------//

const redisClient = redis.createClient(
  10645,
  "redis-10645.c301.ap-south-1-1.ec2.cloud.redislabs.com",
  { no_ready_check: true }
);
redisClient.auth("x3nVz7zjAArrQ8D0Q4Zl0elufm2nlLbB", function (err) {
  if (err) throw err;
});

redisClient.on("connect", async function () {
  console.log("Connected to Redis..");
});

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);

//-------------------------------create api----------------------------------------//

const createShorturl = async function (req, res) {
  try {
    let {longUrl} = req.body
    if(!Object.keys(req.body).length){
        return  res.status(400).send({
            status: false,
            msg: "Please send some DATA in the request body!"
        })
    }
    if(!longUrl){
        return  res.status(400).send({
            status: false,
            msg: "LongURL is a mandatory field!"
        })
    }
    if(typeof(longUrl) != 'string'){
        return  res.status(400).send({
            status: false,
            msg: "LongURL can be in a String only!"
        })
    }
    let cacheUrl = await GET_ASYNC(`${req.body.longUrl}`)
    if(cacheUrl){
        cacheUrl = JSON.parse(cacheUrl)
        return  res.status(200).send({
            status: true,
            msg: "This URL is already present!",
            data: cacheUrl
        })
    }

    let checkLongUrl = await urlModel.findOne({longUrl: longUrl})
    if(checkLongUrl){
       
        await SET_ASYNC(`${checkLongUrl.longUrl}`, JSON.stringify(checkLongUrl))
      
        return  res.status(200).send({
            status: true,
            msg: "This URL is already present!",
            data: checkLongUrl
        })
    }

    let correctLink = false
    await axios.get(longUrl)
        .then((res) => {
            if (res.status == 200 || res.status == 201) {
                    correctLink = true;
            }
        })
    .catch((error) => { correctLink = false })

    if(!correctLink){
        return res.status(400).send({ status: false, message: "Not a Valid URL !" })
    }

    let baseUrl = 'http://localhost:3000'
    let urlCode = shortid.generate().toLowerCase()
    let shortUrl = baseUrl + '/' + urlCode

    let createURL = await urlModel.create({longUrl, shortUrl, urlCode})
    res.status(201).send({
        status: true,
        msg: "URL created!",
        data: createURL
    })
}
catch(e){
    res.status(500).send({
        status: false,
        msg: e.message
    })
}
};

//----------------------------get api------------------------------------//

const fetchUrlData = async function (req, res) {
  try{
    let cacheUrl = await GET_ASYNC(`${req.params.urlCode}`)
    if(cacheUrl===undefined){
        cacheUrl = JSON.parse(cacheUrl)
        return res.status(302).redirect(cacheUrl.longUrl)
    }
    let findURL = await urlModel.findOne({ urlCode: req.params.urlCode });
    if (!findURL) {
      return res.status(404).send({
        status: false,
        msg: "No such urlCode found!",
      });
    }
    await SET_ASYNC(`${req.params.urlCode}`, JSON.stringify(findURL));
    return res.status(302).redirect(findURL.longUrl);
  } catch (err) {
    res.status(500).send({
      status: false,
      msg: err.message,
    });
  }
};


module.exports = { createShorturl, fetchUrlData };



