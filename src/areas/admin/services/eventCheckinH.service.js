const mongoose = require('mongoose');
const EventCheckinH = require('../../../model/EventCheckin_h');
const WORKFLOW_STEPS = EventCheckinH.WORKFLOW_STEPS || {
    INIT: 0,
    ATHLETES: 1,
    MAIL_QR: 2,
    CHECKIN: 3,
    DONE: 4,
};

const CNAME = 'eventCheckinH.service.js ';

class EventCheckinHService {
    async list(conditions = {}) {
        try {
            return await EventCheckinH.find(conditions).sort({ updatedAt: -1 }).lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return [];
        }
    }

    async getById(id) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id)) return null;
            return await EventCheckinH.findById(id).lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    async create(payload) {
        try {
            const doc = new EventCheckinH(payload);
            await doc.save();
            return doc.toObject();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    async updateById(id, payload) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id)) return null;
            const allowed = [
                'name',
                'slug',
                'short_id',
                'desc',
                'img_thumb',
                'img_banner',
                'location',
                'start_date',
                'end_date',
                'is_show',
                'status',
                'race_type',
                'organizer_name',
                'organizer_web',
                'organizer_fanpage',
                'organizer_zalo',
                'workflow_step',
                'max_confirmed_step',
            ];
            const $set = {};
            for (const k of allowed) {
                if (payload[k] !== undefined) $set[k] = payload[k];
            }
            return await EventCheckinH.findByIdAndUpdate(id, { $set }, { new: true }).lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    async setWorkflowStep(id, step) {
        const n = Number(step);
        if (Number.isNaN(n) || n < 0 || n > 4) return null;
        return this.updateById(id, { workflow_step: n });
    }

    /**
     * Xác nhận hoàn thành bước `stepIndex` (chỉ bước tiếp theo theo thứ tự: stepIndex === max_confirmed_step + 1).
     * Cập nhật max_confirmed_step và đưa workflow_step sang bước kế tiếp (hoặc giữ ở 4).
     */
    async confirmStep(id, stepIndex) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id)) return null;
            const k = Number(stepIndex);
            if (Number.isNaN(k) || k < 0 || k > 4) return null;
            const event = await EventCheckinH.findById(id).lean();
            if (!event) return null;
            const mc = event.max_confirmed_step != null ? Number(event.max_confirmed_step) : -1;
            if (k !== mc + 1) return null;
            const newMax = k;
            const newWorkflow = Math.min(4, k + 1);
            return await EventCheckinH.findByIdAndUpdate(
                id,
                { $set: { max_confirmed_step: newMax, workflow_step: newWorkflow } },
                { new: true },
            ).lean();
        } catch (e) {
            console.log(CNAME, e.message);
            return null;
        }
    }

    async deleteById(id) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id)) return false;
            const r = await EventCheckinH.findByIdAndDelete(id);
            return !!r;
        } catch (e) {
            console.log(CNAME, e.message);
            return false;
        }
    }
}

module.exports = new EventCheckinHService();
module.exports.WORKFLOW_STEPS = WORKFLOW_STEPS;
