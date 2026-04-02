function trim(s) {
    return String(s ?? '').trim();
}

function parseDelegationBody(body) {
    if (!body || typeof body !== 'object') body = {};
    const enabled =
        body.delegation_enabled === 'true' ||
        body.delegation_enabled === 'on' ||
        body.delegation_enabled === true;
    return {
        delegation_enabled: enabled,
        delegate_fullname: trim(body.delegate_fullname ?? body.sd_fullname),
        delegate_email: trim(body.delegate_email ?? body.sd_email),
        delegate_phone: trim(body.delegate_phone ?? body.sd_phone),
        delegate_cccd: trim(body.delegate_cccd ?? body.sd_cccd),
    };
}

/** Map form (tool) fullname/email/phone/cccd → delegate_* shape */
function parseDelegationFromToolBody(body) {
    if (!body || typeof body !== 'object') body = {};
    return {
        delegation_enabled: true,
        delegate_fullname: trim(body.fullname),
        delegate_email: trim(body.email),
        delegate_phone: trim(body.phone),
        delegate_cccd: trim(body.cccd),
    };
}

function finalizeDelegationState(n) {
    if (!n.delegation_enabled || !n.delegate_fullname) {
        return {
            delegation_enabled: false,
            delegate_fullname: '',
            delegate_email: '',
            delegate_phone: '',
            delegate_cccd: '',
        };
    }
    return {
        delegation_enabled: true,
        delegate_fullname: n.delegate_fullname,
        delegate_email: n.delegate_email,
        delegate_phone: n.delegate_phone,
        delegate_cccd: n.delegate_cccd,
    };
}

function snapshotFromParticipant(p) {
    return {
        delegation_enabled: p.delegation_enabled === true,
        delegate_fullname: trim(p.delegate_fullname),
        delegate_email: trim(p.delegate_email),
        delegate_phone: trim(p.delegate_phone),
        delegate_cccd: trim(p.delegate_cccd),
    };
}

function snapshotEqual(a, b) {
    return (
        a.delegation_enabled === b.delegation_enabled &&
        a.delegate_fullname === b.delegate_fullname &&
        a.delegate_email === b.delegate_email &&
        a.delegate_phone === b.delegate_phone &&
        a.delegate_cccd === b.delegate_cccd
    );
}

function computeDelegationAction(oldSnap, newSnap) {
    if (snapshotEqual(oldSnap, newSnap)) return null;
    if (!newSnap.delegation_enabled || !newSnap.delegate_fullname) {
        return oldSnap.delegation_enabled ? 'clear' : null;
    }
    if (!oldSnap.delegation_enabled || !oldSnap.delegate_fullname) return 'set';
    return 'update';
}

function buildDelegationLogSummary(actorType, action, state) {
    const who = actorType === 'admin' ? 'Admin' : 'User';
    if (action === 'clear') return `${who} - Unauthorized`;
    return `${who} - Authorized: ${state.delegate_fullname} - ID: ${state.delegate_cccd || '—'} - Phone: ${state.delegate_phone || '—'}`;
}

module.exports = {
    parseDelegationBody,
    parseDelegationFromToolBody,
    finalizeDelegationState,
    snapshotFromParticipant,
    computeDelegationAction,
    buildDelegationLogSummary,
};
