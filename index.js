let token = ''
const config = require('./config.json')
const express = require('express')
const app = express()
var unirest = require('unirest');
const Database = require('better-sqlite3');
const db = new Database("prices.db");
db.exec(`CREATE TABLE IF NOT EXISTS prices (time INT, id INT, name TEXT, reg REAL, mid REAL, prem REAL, diesel REAL, PRIMARY KEY (time, id))`)
let cacheddb = {}
let allst = db.prepare("SELECT * FROM prices")
cacheddb = allst.all();
let webhook = config.webhook
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
                    unirest('POST', 'https://api.app.rovertown.com/v4/sms/refreshToken')
                        .headers({
                            'x-RT-appbundleid': 'com.excentus.wesco',
                            'x-RT-clientosversion': '16',
                            'X-Auth-Token': '',
                            'User-Agent': 'okhttp/5.0.0-alpha.2',
                            'Accept': 'application/json',
                            'Content-Type': 'application/x-www-form-urlencoded'
                        })
                        .send(`gmt_offset=${config.gmt_offset}`)
                        .send(`device_type=${config.device_type}`)
                        .send(`version=${config.version}`)
                        .send(`build=${config.build}`)
                        .send(`platform_id=${config.platform_id}`)
                        .send(`device_uid=${config.device_uid}`)
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
                    let fullmessage = ''
                    stations.forEach(place => {
                        let prices = {}
                        place.store.gas.forEach(ga => {
                            prices[ga.type] = ga.price
                        })

                        if(prices["Regular"] !== lastPrices.get(place.store.id)){
                            let ping = ''
                            if(Number(prices["Regular"]) && (Number(prices["Regular"]) - lastPrices.get(place.store.id) > 0.10)){
                                ping = `<@${config.discordPingID}>`
                            }
                            insertSt.run(new Date().getTime(), place.store.id, place.store.name, prices["Regular"], prices["Mid-Grade"], prices["Premium"], prices["Diesel"])
                            console.log(`${new Date().getTime()} PRICE UPDATE: ${place.store.name}: ${lastPrices.get(place.store.id)} -> ${prices["Regular"]}`)
                            fullmessage = fullmessage + `${ping} ${new Date().toLocaleTimeString("en-US", {timeZone: "America/New_York"})}: ${place.store.name}: ${lastPrices.get(place.store.id)} -> ${prices["Regular"]}\n`

                            lastPrices.set(place.store.id, prices["Regular"])
                        }
                    })
                    unirest('POST', webhook)
                        .field('content', fullmessage)
                        .end(function (res) {
                            if (res.error) console.log(res.error);
                        });
                })
                tran(res.body.data.places);
                cacheddb = allst.all();
            }
        });

}
fetch()
setInterval(fetch, 5 * 60 * 1000)

// Mostly Gemini generated and experimental, the main point of this project is mostly just notifications
app.get('/data', (req, res) => {
    // 1. SETUP THE TIME GRID
    // We want the last 24 hours (or 3 days, etc)
    const NOW = Date.now();
    const WINDOW_SIZE = 24 * 60 * 60 * 1000; // 24 Hours
    const START_TIME = NOW - WINDOW_SIZE;
    const BLOCK_SIZE = 5 * 60 * 1000; // 5 Minute Blocks (Match your chart colSize)

    // 2. FETCH RAW DATA (Sparse)
    // Fetch EVERYTHING from the DB to be safe (or optimize with WHERE timestamp > START_TIME - 7 days)
    const rawRows = db.prepare(`
        SELECT time, id, name, reg 
        FROM prices 
        ORDER BY time ASC
    `).all();

    // 3. GROUP BY STATION
    const stations = {};
    rawRows.forEach(row => {
        if (!stations[row.id]) {
            stations[row.id] = { name: row.name, history: [] };
        }
        stations[row.id].history.push(row);
    });

    const filledData = [];

    // 4. PERFORM FORWARD FILL PER STATION
    Object.keys(stations).forEach(stationId => {
        const station = stations[stationId];
        const history = station.history;

        // A. FIND STARTING PRICE (The "Anchor")
        // Look for the last record that happened BEFORE our chart starts
        // If we don't find one, we default to the FIRST record in the window (Back-fill effect)
        let currentPrice = null;
        const recordBeforeStart = history.filter(r => r.time < START_TIME).pop();

        if (recordBeforeStart) {
            currentPrice = recordBeforeStart.reg;
        } else if (history.length > 0) {
            // Cold Start Fix: If no history exists before window, use the first known price
            // This prevents "White Space" on the left side of the chart
            currentPrice = history[0].reg;
        }

        // B. WALK THE TIMELINE (The Forward Fill Loop)
        let historyIndex = 0;

        // Skip history records that are way in the past to save speed
        while(historyIndex < history.length && history[historyIndex].time < START_TIME) {
            historyIndex++;
        }

        // Loop from Start -> Now in 15 min steps
        for (let time = START_TIME; time <= NOW; time += BLOCK_SIZE) {

            // Check if a REAL update happened in this time block
            // We use a while loop in case multiple updates happened in one block (we take the last one)
            while (
                historyIndex < history.length &&
                history[historyIndex].time <= time
                ) {
                currentPrice = history[historyIndex].reg;
                historyIndex++;
            }

            // If we have a price, add it to the final dataset
            if (currentPrice !== null) {
                filledData.push({
                    time: time,
                    name: station.name,
                    reg: currentPrice
                });
            }
        }
    });

    // 5. SEND DENSE DATA
    res.send(filledData);
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html')
})
app.listen(config.port, config.ip)