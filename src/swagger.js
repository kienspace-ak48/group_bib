// swagger.js
const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });;

const doc = {
  info: {
    title: 'Group bib',
    descripion: 'Tài liệu API tự động tạo bằng swagger-autogen',
  },
  host: 'localhost:8080',
  schemes: ['http'],
  tags: [
    {
        name: 'Events',
        description: 'cac api event' 
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    }
  },
  security: [{ bearerAuth: [] }]
};

const outputFile = './swagger/swagger-output.json'; // file JSON sẽ được tạo
const endpointsFiles = ['./routes/index.js'];        // file chính hoặc file route ./app.js

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
  console.log('Swagger docs đã được tạo:', outputFile);
});
