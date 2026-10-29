const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');
const { env } = require('./config/env');
const { documentacao } = require('./docs/swagger');
const { tratarErros, rotaNaoEncontrada } = require('./middlewares/tratarErros');
const rotas = require('./routes');

const app = express();

// O Render fica atrás de um proxy: sem isso, o limite por IP veria só o IP do proxy
app.set('trust proxy', 1);

// resposta.id e log_auditoria.id são BIGINT, e o res.json quebraria com BigInt (TypeError)
app.set('json replacer', (chave, valor) => (typeof valor === 'bigint' ? valor.toString() : valor));

app.use(
  helmet({
    contentSecurityPolicy: {
      // Forçar HTTPS só faz sentido publicado; no localhost impediria o Swagger de carregar
      directives: { upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null },
    },
  }),
);
app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json({ limit: '100kb' }));

if (env.NODE_ENV !== 'test') {
  app.use(
    pinoHttp({
      level: env.LOG_NIVEL,
      // Só método, rota, status e tempo: o corpo e o cabeçalho Authorization podem
      // conter telefone, textos dos pacientes ou o token, e nunca vão para o log
      serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      // O Render consulta /api/saude o tempo todo; registrar isso só encheria o log
      autoLogging: { ignore: (req) => req.url === '/api/saude' },
    }),
  );
}

app.get('/api/saude', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/docs', documentacao);
app.use(rotas);

// Sempre por último: rota inexistente e o formato único de erro (seção 7.4 da arquitetura)
app.use(rotaNaoEncontrada);
app.use(tratarErros);

module.exports = app;
