const mongoose = require('mongoose');
const LoginHistory = require('../../../model/login_history.model');
const { accountLabel } = require('../../../utils/accountDisplay.util');

const CNAME = 'loginHistory.service.js ';

class LoginHistoryService {
    async recordSuccess(accountId, req) {
        try {
            const doc = {
                account_id: accountId,
                at: new Date(),
                success: true,
                method: 'password',
                ip: req?.ip || req?.headers?.['x-forwarded-for'] || '',
                user_agent: req?.headers?.['user-agent'] || '',
            };
            await LoginHistory.create(doc);
        } catch (e) {
            console.log(CNAME, e.message);
        }
    }

    async recordFailure(accountId, reason, req) {
        try {
            const row = {
                at: new Date(),
                success: false,
                failure_reason: reason,
                method: 'password',
                ip: req?.ip || '',
                user_agent: req?.headers?.['user-agent'] || '',
            };
            if (accountId && mongoose.Types.ObjectId.isValid(accountId)) row.account_id = accountId;
            await LoginHistory.create(row);
        } catch (e) {
            console.log(CNAME, e.message);
        }
    }

    async list(options = {}) {
        const { page = 1, limit = 50, accountId } = options;
        const skip = (page - 1) * limit;
        const q = {};
        if (accountId && mongoose.Types.ObjectId.isValid(accountId)) {
            q.account_id = accountId;
        }
        const [rawItems, total] = await Promise.all([
            LoginHistory.find(q)
                .sort({ at: -1 })
                .skip(skip)
                .limit(limit)
                .populate({ path: 'account_id', select: 'name username' })
                .lean(),
            LoginHistory.countDocuments(q),
        ]);
        const items = rawItems.map((row) => ({
            ...row,
            account_display: accountLabel(row.account_id),
        }));
        return { items, total, page, limit, pages: Math.ceil(total / limit) || 1 };
    }
}

module.exports = new LoginHistoryService();
