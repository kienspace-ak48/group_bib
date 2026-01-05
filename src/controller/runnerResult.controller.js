//
const CNAME = 'runnerResultController.js ';
const axios = require('axios');
const Runner = require('../model/Runner');
const RaceEvent = require('../model/RaceEvent');
const Distance = require('../model/Distance');

const runnerResultController = () => {
    return {
        Index: async (req, res) => {
            // res.json({success: true, mess: "hi"})
            try {
                const re = await RaceEvent.findOne().lean();
                console.log(re);
                const scores = await Runner.find({ item_id: 8440 }).lean();

                // const distances = await re.distances.sort((a, b) => a.distance - b.distance);
                const distances = await Distance.find().sort({all_distance: 1});
                console.log('distance ', distances);
                console.log('disrance get ', distances);
                const count = scores.length;
                //top 10;

                console.log(count);
                res.render('pages/runnerResult', { layout: 'layouts/main', scores, re, count, distances });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },

        GetByDistance: async (req, res) => {
            try {
                const _distanceId = req.params.distance;
                const runners = await Runner.find({ item_id: _distanceId }).limit(10).lean();
                const distance = await Distance.find().sort({all_distance: 1});
                const allCP = await Distance.find()
                const count = runners.length;
                res.json({ success: true, count, data: runners, distance });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
        CallAPI: async (req, res) => {
            const apiString = 'https://time.feibot.com/api/scores-data/X5Rw2f00qy';
            var data = null;
            var eventName = null;
            var date_time = null;
            var id_eventfeibot = null;
            var items = [];
            var scores = [];
            var runner_result = [];
            try {
                await axios
                    .get(apiString)
                    .then((resp) => {
                        data = resp.data;
                        eventName = resp.data.race.title;
                        const timestamp = resp.data.race.date_time;
                        const date = new Date(timestamp * 1000);
                        const dateTimeVN = date.toLocaleString('vi-VN', {
                            timeZone: 'Asia/Ho_Chi_Minh',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false,
                        });
                        // console.log(dateTimeVN);
                        var list = [];
                        const arr = resp.data.scores.map((item) => {
                            var r = new Runner({
                                id: item.id,
                                name: item.name,
                                gender: item.sex,
                                bib: item.bib,
                                epc: item.epc,
                                item_id: item.item_id,
                                total_score: item.total_score,
                                net_score: item.net_score,
                                start_time: item.start_time,
                                item_total_ranking: item.item_total_ranking,
                                item_name: item.name,
                                cp1: item.cp1,
                                cp2: item.cp2,
                                cp3: item.cp3,
                                cp4: item.cp4,
                                cp5: item.cp5,
                                cp6: item.cp6,
                                cp7: item.cp7,
                                cp8: item.cp8,
                                cp9: item.cp9,
                                finish_time: item.finish_time,
                                pace: item.pace,
                                cp1_cp2: item.cp1_cp2,
                                cp2_cp3: item.cp2_cp3,
                                cp3_cp4: item.cp3_cp4,
                                cp4_cp5: item.cp4_cp5,
                                cp5_cp6: item.cp5_cp6,
                                cp6_cp7: item.cp6_cp7,
                                cp7_cp8: item.cp7_cp8,
                                cp8_cp9: item.cp8_cp9,
                            });
                            list.push(r);
                        });
                        // const result = Runner.insertMany(list);
                        // console.log('kq insert ',result)
                        // console.log(list)
                        const mappedScores = resp.data.scores.map((item) => ({
                            id: item.id,
                            name: item.name,
                            gender: item.sex,
                            bib: item.bib,
                            epc: item.epc,
                            item_id: item.item_id,
                            total_score: item.total_score,
                            net_score: item.net_score,
                            start_time: item.start_time,
                            item_total_ranking: item.item_total_ranking,
                            item_name: item.name,
                            cp1: item.cp1,
                            cp2: item.cp2,
                            cp3: item.cp3,
                            cp4: item.cp4,
                            cp5: item.cp5,
                            cp6: item.cp6,
                            cp7: item.cp7,
                            cp8: item.cp8,
                            cp9: item.cp9,
                            finish_time: item.finish_time,
                            pace: item.pace,
                            cp1_cp2: item.cp1_cp2,
                            cp2_cp3: item.cp2_cp3,
                            cp3_cp4: item.cp3_cp4,
                            cp4_cp5: item.cp4_cp5,
                            cp5_cp6: item.cp5_cp6,
                            cp6_cp7: item.cp6_cp7,
                            cp7_cp8: item.cp7_cp8,
                            cp8_cp9: item.cp8_cp9,
                        }));
                        runner_result = list;
                        date_time = dateTimeVN;
                        id_eventfeibot = resp.data.race.id;
                        items = resp.data.race.items;
                        const re = new RaceEvent({
                            name: eventName,
                            id_feibot: id_eventfeibot,
                            date_time: date,
                            distances: items,
                        });
                        // const dAPI = ;
                        var distanceAPI = resp.data.item_check_points;
                        // distance
                        var arrDistance = [];
                        distanceAPI.forEach((item) => {
                            let distance = new Distance({
                                item_id: item.item_id,
                                title: item.title,
                                checkpoints: item.checkpoints,
                                all_distance: item.all_distance,
                            });
                            arrDistance.push(distance);
                        });
                        // Distance.insertMany(arrDistance);
                        console.log('kq ', arrDistance);

                        // re.save();
                    })
                    .catch((error) => {
                        console.error(error);
                    });
                res.json({
                    success: true,
                    data: runner_result,
                    bonus: { api: apiString, eventName, date_time: date_time, id_eventfeibot, items, runner_result },
                });
            } catch (error) {
                console.log(CNAME, error.message);
                res.status(500).json({ success: false, mess: error.message });
            }
        },
        ImportRunnerData: async (req, res) => {
            try {
                const apiString = 'https://time.feibot.com/api/scores-data/X5Rw2f00qy';
                var runnerdata = await axios.get(apiString);
            } catch (error) {}
        },
    };
};

module.exports = runnerResultController;
