/** Nhãn hiển thị cho account populate (audit, login history). */
function accountLabel(acc) {
    if (acc == null) return '—';
    if (typeof acc === 'object' && acc !== null) {
        const n = acc.name != null && String(acc.name).trim();
        const u = acc.username != null && String(acc.username).trim();
        if (n) return n;
        if (u) return u;
    }
    return '—';
}

module.exports = { accountLabel };
