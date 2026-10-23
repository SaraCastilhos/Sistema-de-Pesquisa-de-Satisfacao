const app = require('./app');
const { env } = require('./config/env');

app.listen(env.PORT, () => {
  console.log(`API rodando em http://localhost:${env.PORT} (documentação em /api/docs)`);
});
