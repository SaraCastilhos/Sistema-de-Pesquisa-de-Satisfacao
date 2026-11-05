/** Regras das ações da Ouvidoria sobre um chamado (FS6): quando cada uma vale e o corpo do registro. */

export const TENTATIVAS_MINIMAS_SEM_RETORNO = 3; // igual a REGRAS.TENTATIVAS_MINIMAS_SEM_RETORNO do backend
export const MAXIMO_FOTOS = 3; // ANEXOS_POR_MANIFESTACAO
export const MAXIMO_TEXTO = 2000;
export const MAXIMO_PROFISSIONAL = 120;

export const estaAberto = (chamado) => chamado.status === 'NOVA' || chamado.status === 'EM_CONTATO';

/** O chamado tem telefone a quem ligar? (anônimo e telefone já apagado, não) */
export const temTelefone = (chamado) => Boolean(chamado.pediuRetorno && chamado.telefone);

/** Tentativas só em chamado aberto com telefone (RF15). */
export const podeRegistrarTentativa = (chamado) => estaAberto(chamado) && temTelefone(chamado);

/** Fotos só na origem PAPEL, em chamado aberto, até 3 (RF17). */
export const podeAnexarFoto = (chamado) =>
  chamado.origem === 'PAPEL' && estaAberto(chamado) && chamado.anexos.length < MAXIMO_FOTOS;

export const contarSemSucesso = (chamado) =>
  chamado.tentativas.filter((t) => t.resultado === 'SEM_SUCESSO').length;

/**
 * Situação da finalização. `bloqueio` é o motivo de não poder finalizar (RN12: sem tipo);
 * `semRetorno` diz se a opção "Sem retorno" aparece e se está habilitada.
 */
export function situacaoDaFinalizacao(chamado) {
  const bloqueio = chamado.tipo
    ? null
    : 'Classifique o tipo da manifestação antes de finalizar o chamado.';
  const aparece = temTelefone(chamado);
  const faltam = Math.max(0, TENTATIVAS_MINIMAS_SEM_RETORNO - contarSemSucesso(chamado));
  return {
    bloqueio,
    semRetorno: {
      aparece,
      habilitado: aparece && !bloqueio && faltam === 0,
      faltam,
    },
  };
}

/** Frase de confirmação antes de finalizar (RN07). */
export function textoDaConfirmacao(chamado) {
  return temTelefone(chamado)
    ? 'O telefone será apagado e o chamado não poderá ser reaberto.'
    : 'O chamado não poderá ser reaberto.';
}

/** "2026-10-30T17:00:00.000Z" → "2026-10-30T14:00" (para o campo datetime-local, no fuso do navegador). */
export function paraCampoDataHora(data = new Date()) {
  const deslocada = new Date(data.getTime() - data.getTimezoneOffset() * 60_000);
  return deslocada.toISOString().slice(0, 16);
}

/** "2026-10-30T14:00" (hora do navegador) → ISO com fuso, aceito pela API. */
export function dataHoraParaIso(valor) {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

/**
 * Corpo do POST /api/manifestacoes a partir do formulário, ou { erros } se faltar algo.
 * Relato e telefone não podem ficar os dois vazios; telefone exige a autorização (RN06) e o termo
 * vigente; fotos só com origem PAPEL (por isso `fotosPermitidas` está aqui, junto do corpo).
 */
export function montarRegistro(form, termo, hoje = new Date().toISOString().slice(0, 10)) {
  const erros = {};
  const texto = form.texto.trim();
  const telefone = form.telefone.trim();

  if (!form.origem) erros.origem = 'Escolha a origem.';
  if (!form.tipo) erros.tipo = 'Escolha o tipo.';
  if (!form.setorId) erros.setorId = 'Escolha o setor.';
  if (!form.dataOcorrencia) erros.dataOcorrencia = 'Informe a data.';
  else if (form.dataOcorrencia > hoje) erros.dataOcorrencia = 'A data não pode ser futura.';
  if (!texto && !telefone) erros.texto = 'Escreva o relato ou informe um telefone para retorno.';
  if (texto.length > MAXIMO_TEXTO)
    erros.texto = `O relato pode ter até ${MAXIMO_TEXTO} caracteres.`;
  if (form.profissionalCitado.trim().length > MAXIMO_PROFISSIONAL) {
    erros.profissionalCitado = `O nome pode ter até ${MAXIMO_PROFISSIONAL} caracteres.`;
  }
  if (telefone) {
    if (!form.autorizou) erros.autorizou = 'Confirme a autorização do paciente para o contato.';
    if (!termo) erros.autorizou = 'Os termos de privacidade não foram carregados.';
  }
  if (Object.keys(erros).length > 0) return { erros };

  const corpo = {
    origem: form.origem,
    tipo: form.tipo,
    setorId: Number(form.setorId),
    dataOcorrencia: form.dataOcorrencia,
  };
  if (form.turnoId) corpo.turnoId = Number(form.turnoId);
  if (form.etapaId) corpo.etapaId = Number(form.etapaId);
  if (form.profissionalCitado.trim()) corpo.profissionalCitado = form.profissionalCitado.trim();
  if (texto) corpo.texto = texto;
  if (telefone) {
    corpo.telefone = telefone;
    corpo.aceiteTermos = true;
    corpo.termoId = termo.id;
  }
  return { corpo };
}

/** As fotos só acompanham o registro de origem PAPEL, no máximo 3. */
export const fotosDoRegistro = (origem, fotos) =>
  origem === 'PAPEL' ? fotos.slice(0, MAXIMO_FOTOS) : [];
