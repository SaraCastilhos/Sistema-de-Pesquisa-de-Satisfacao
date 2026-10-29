const fs = require('node:fs');
const path = require('node:path');
const { Router } = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');

const PASTA_MODULOS = path.join(__dirname, '..', 'modules');

function lerYaml(caminho) {
  return YAML.parse(fs.readFileSync(caminho, 'utf8')) ?? {};
}

// Junta openapi.base.yaml com o <módulo>.openapi.yaml de cada módulo. Cada integrante
// escreve só o contrato dos seus módulos, então nunca editam o mesmo arquivo.
function montarContrato() {
  const contrato = lerYaml(path.join(__dirname, 'openapi.base.yaml'));
  contrato.paths ??= {};
  contrato.tags ??= [];
  contrato.components ??= {};
  contrato.components.schemas ??= {};

  const modulos = fs
    .readdirSync(PASTA_MODULOS, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name)
    .sort();

  for (const modulo of modulos) {
    const caminho = path.join(PASTA_MODULOS, modulo, `${modulo}.openapi.yaml`);
    if (!fs.existsSync(caminho)) continue;
    const parte = lerYaml(caminho);

    // Uma rota ou um schema com o mesmo nome em dois módulos impede a API de iniciar,
    // em vez de um contrato sobrescrever o outro sem ninguém perceber.
    for (const [rota, definicao] of Object.entries(parte.paths ?? {})) {
      if (contrato.paths[rota]) {
        throw new Error(
          `Contrato OpenAPI: a rota ${rota} aparece em mais de um arquivo (${modulo})`,
        );
      }
      contrato.paths[rota] = definicao;
    }
    for (const [nome, schema] of Object.entries(parte.components?.schemas ?? {})) {
      if (contrato.components.schemas[nome]) {
        throw new Error(
          `Contrato OpenAPI: o schema ${nome} aparece em mais de um arquivo (${modulo})`,
        );
      }
      contrato.components.schemas[nome] = schema;
    }
    contrato.tags.push(...(parte.tags ?? []));
  }

  return contrato;
}

const contrato = montarContrato();
const documentacao = Router();

documentacao.get('/openapi.json', (req, res) => res.json(contrato));
documentacao.use('/', swaggerUi.serve, swaggerUi.setup(contrato));

module.exports = { documentacao, montarContrato };
