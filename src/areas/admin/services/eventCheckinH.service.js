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
                'checkin_capture_mode',
                'single_delegation_enabled',
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

    /**
     * Trang chủ client: chỉ sự kiện admin bật "hiển thị công khai".
     * Trả về object phẳng — không gồm workflow, checkin_capture_mode, Mongo id, v.v.
     */
    async listPublicForHome() {
        try {
            const select =
                'name slug short_id desc img_thumb img_banner location start_date end_date race_type status organizer_name organizer_web organizer_fanpage organizer_zalo';
            const rows = await EventCheckinH.find({ is_show: true }).select(select).sort({ start_date: -1 }).lean();
            return rows.map((r) => ({
                name: r.name || '',
                slug: r.slug || '',
                short_id: r.short_id || '',
                desc: r.desc || '',
                img_thumb: r.img_thumb || '',
                img_banner: r.img_banner || '',
                location: r.location || '',
                start_date: r.start_date,
                end_date: r.end_date,
                race_type: r.race_type || '',
                status: r.status || '',
                organizer_name: r.organizer_name || '',
                organizer_web: r.organizer_web || '',
                organizer_fanpage: r.organizer_fanpage || '',
                organizer_zalo: r.organizer_zalo || '',
            }));
        } catch (e) {
            console.log(CNAME, e.message);
            return [];
        }
    }

    /** Tháng có ít nhất một sự kiện (lọc UI trang chủ). */
    buildMonthFilterOptions(events) {
        const keys = new Set();
        for (const ev of events) {
            const d = ev.start_date ? new Date(ev.start_date) : null;
            if (!d || Number.isNaN(d.getTime())) continue;
            keys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return Array.from(keys)
            .sort()
            .map((key) => {
                const [y, m] = key.split('-');
                return { key, label: `Tháng ${parseInt(m, 10)}/${y}` };
            });
    }
}

module.exports = new EventCheckinHService();
module.exports.WORKFLOW_STEPS = WORKFLOW_STEPS;
