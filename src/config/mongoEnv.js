/**
 * Chuỗi kết nối MongoDB: ưu tiên MONGO_URI, sau đó MONGODB_URI (tương thích .env cũ).
 */
function getMongoUri() {
    const raw = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (raw == null) return null;
    const s = String(raw).trim();
    return s || null;
}

module.exports = { getMongoUri };
