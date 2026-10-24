// A aplicação Express sem abrir porta: o Supertest chama as rotas direto.
//   const request = require('supertest');
//   const app = require('../helpers/app');
//   await request(app).get('/api/saude');
module.exports = require('../../src/app');
