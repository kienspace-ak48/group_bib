const mongoose = require('mongoose');
const eventBulkMailService = require('../areas/admin/services/eventBulkMail.service');

let tickRunning = false;
let intervalId = null;

async function tick() {
    if (tickRunning) return;
    if (mongoose.connection.readyState !== 1) return;
    tickRunning = true;
    try {
        await eventBulkMailService.processMailBulkWorkerTick();
    } catch (e) {
        console.error('mailBulk.worker tick', e);
    } finally {
        tickRunning = false;
    }
}

function startMailBulkWorker() {
    if (intervalId != null) return;
    intervalId = setInterval(tick, 2000);
    setImmediate(tick);
}

module.exports = { startMailBulkWorker };
