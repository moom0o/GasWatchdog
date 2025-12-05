let token = ''
const express = require('express')
const app = express()
var unirest = require('unirest');
const Database = require('better-sqlite3');
const db = new Database("prices.db");
db.exec(`CREATE TABLE IF NOT EXISTS prices (time INT, id INT, name TEXT, reg REAL, mid REAL, prem REAL, diesel REAL, PRIMARY KEY (time, id))`)
let cacheddb = {}
let allst = db.prepare("SELECT * FROM prices")
cacheddb = allst.all();
let webhook = "X"
const insertSt = db.prepare(`INSERT INTO prices (time, id, name, reg, mid, prem, diesel) VALUES (?,?,?,?,?,?,?)`)
const lastPrices = new Map()
function fetch(failsafe){
    var req = unirest('POST', 'https://api.app.rovertown.com/v2/map/list')
        .headers({
            'X-Auth-Token': token,
            'x-RT-appbundleid': 'com.excentus.wesco',
            'x-RT-clientosversion': '16',
            'Content-Type': 'application/json',
            'User-Agent': 'okhttp/5.0.0-alpha.2'
        })
        .send(JSON.stringify({
            "latitude": 0,
            "longitude": 0
        }))
        .end(function (res) {
            if (res.error) {
                console.log(res.error.message)
                if(res.error.message.includes("403") || res.error.message.includes("408")){
                    console.log("Fetching new token")
                    var unirest = require('unirest');
                    var req = unirest('POST', 'https://api.app.rovertown.com/v4/sms/refreshToken')
                        .headers({
                            'x-RT-appbundleid': 'com.excentus.wesco',
                            'x-RT-clientosversion': '16',
                            'X-Auth-Token': '',
                            'User-Agent': 'okhttp/5.0.0-alpha.2',
                            'Accept': 'application/json',
                            'Content-Type': 'application/x-www-form-urlencoded'
                        })
                        .send('gmt_offset=-0500')
                        .send('device_type=Pixel 6 Pro')
                        .send('version=42.01.01')
                        .send('build=50003')
                        .send('platform_id=119')
                        .send('device_uid=92c4b821a0f9e3d5')
                        .end(function (res) {
                            if (res.error){  console.log(res.error)} else {
                                token = res.body.data.token
                                if(!failsafe){
                                    fetch(true)
                                }
                            }
                        });

                } else {
                    console.log(res.error)
                }
            } else {
                let tran = db.transaction((stations) => {
                    stations.forEach(place => {
                        let prices = {}
                        place.store.gas.forEach(ga => {
                            prices[ga.type] = ga.price
                        })

                        if(prices["Regular"] !== lastPrices.get(place.store.id)){
                            insertSt.run(new Date().getTime(), place.store.id, place.store.name, prices["Regular"], prices["Mid-Grade"], prices["Premium"], prices["Diesel"])
                            console.log(`${new Date().getTime()} PRICE UPDATE: ${place.store.name}: ${lastPrices.get(place.store.id)} -> ${prices["Regular"]}`)
                            var unirest = require('unirest');
                            var req = unirest('POST', webhook)
                                .field('content', `<@528811409404854273> ${new Date().getTime()} PRICE UPDATE: ${place.store.name}: ${lastPrices.get(place.store.id)} -> ${prices["Regular"]}`)
                                .end(function (res) {
                                    if (res.error) console.log(res.error);
                                });

                            lastPrices.set(place.store.id, prices["Regular"])
                        }
                    })
                })
                tran(res.body.data.places);
                cacheddb = allst.all();
            }
        });

}
fetch()
setInterval(fetch, 5 * 60 * 1000)


app.get('/data', (req, res) => {
    res.send(cacheddb)
})

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html')
})
app.listen(3000)