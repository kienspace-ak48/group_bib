module.exports = {
  apps: [
    {
      name: "accessrace", // Tên app trên PM2
      script: "./src/server/app.js", // File entry point
      watch: false, // true nếu muốn PM2 auto restart khi code thay đổi
      env: {
        NODE_ENV: "development",
        MONGO_URI: "mongodb://localhost:27017/ar-database",
        SECRET_KEY_SIGN: "xxx",
        SECRET_KEY_ENC: "yyy",
        HTTP_PORT: 3500,
      },
      env_production: {
        NODE_ENV: "production",
        MONGO_URI: "mongodb://localhost:27017/ar-database",
        SECRET_KEY_SIGN: "xxx",
        SECRET_KEY_ENC: "yyy",
        HTTP_PORT: 3500,
      },
    },
  ],
};
