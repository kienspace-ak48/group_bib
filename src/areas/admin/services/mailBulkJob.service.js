const mongoose = require('mongoose');
const MailBulkJob = require('../../../model/MailBulkJob');

const ACTIVE = ['queued', 'running'];

async function findActiveJobForEvent(eventId) {
    if (!mongoose.Types.ObjectId.isValid(String(eventId))) return null;
    const eid = new mongoose.Types.ObjectId(String(eventId));
    return MailBulkJob.findOne({
        event_id: eid,
        status: { $in: ACTIVE },
    })
        .sort({ createdAt: -1 })
        .lean();
}

async function findJobByIdForEvent(jobId, eventId) {
    if (!mongoose.Types.ObjectId.isValid(String(jobId))) return null;
    if (!mongoose.Types.ObjectId.isValid(String(eventId))) return null;
    return MailBulkJob.findOne({
        _id: jobId,
        event_id: new mongoose.Types.ObjectId(String(eventId)),
    }).lean();
}

async function findLatestJobForEvent(eventId) {
    if (!mongoose.Types.ObjectId.isValid(String(eventId))) return null;
    return MailBulkJob.findOne({ event_id: new mongoose.Types.ObjectId(String(eventId)) })
        .sort({ createdAt: -1 })
        .lean();
}

async function getJobById(jobId) {
    if (!mongoose.Types.ObjectId.isValid(String(jobId))) return null;
    return MailBulkJob.findById(jobId).lean();
}

/**
 * @param {object} data
 * @param {import('mongoose').Types.ObjectId} data.event_id
 * @param {number} data.total
 * @param {import('mongoose').Types.ObjectId|null} [data.created_by]
 */
async function createQueuedJob(data) {
    const doc = await MailBulkJob.create({
        event_id: data.event_id,
        status: 'queued',
        total: data.total,
        sent: 0,
        failed: 0,
        last_participant_id: null,
        errors_sample: [],
        created_by: data.created_by || undefined,
    });
    return doc.toObject();
}

async function findNextPendingJob() {
    return MailBulkJob.findOne({ status: { $in: ACTIVE } }).sort({ createdAt: 1 });
}

async function markJobFailed(jobId, reason) {
    await MailBulkJob.updateOne(
        { _id: jobId },
        {
            $set: {
                status: 'failed',
                finished_at: new Date(),
                stop_reason: reason ? String(reason).slice(0, 2000) : undefined,
            },
        },
    );
}

async function markJobCompleted(jobId) {
    await MailBulkJob.updateOne(
        { _id: jobId },
        {
            $set: {
                status: 'completed',
                finished_at: new Date(),
            },
        },
    );
}

/**
 * @param {string} jobId
 * @param {object} patch
 */
async function applyBatchResult(jobId, patch) {
    const {
        last_participant_id,
        sentDelta = 0,
        failedDelta = 0,
        pushErrors = [],
    } = patch;
    const job = await MailBulkJob.findById(jobId);
    if (!job) return null;
    job.sent += sentDelta;
    job.failed += failedDelta;
    if (last_participant_id !== undefined) job.last_participant_id = last_participant_id;
    if (pushErrors.length) {
        const cap = 30;
        job.errors_sample = [...job.errors_sample, ...pushErrors].slice(-cap);
    }
    await job.save();
    return job.toObject();
}

module.exports = {
    findActiveJobForEvent,
    findJobByIdForEvent,
    findLatestJobForEvent,
    getJobById,
    createQueuedJob,
    findNextPendingJob,
    markJobFailed,
    markJobCompleted,
    applyBatchResult,
};
