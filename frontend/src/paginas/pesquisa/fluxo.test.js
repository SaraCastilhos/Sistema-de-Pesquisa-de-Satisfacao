import { describe, expect, it } from 'vitest';
import {
  avaliarTelaFixa,
  juntarProgresso,
  montarRespondente,
  PROGRESSO_INICIAL,
  progressoDaSituacao,
  proximoPasso,
} from './fluxo';

const PESQUISA = {
  etapas: [
    { id: 1, nome: 'Recepção', perguntas: [{ id: 10 }, { id: 11 }] },
    { id: 2, nome: 'Médico', perguntas: [{ id: 20 }] },
  ],
};
const SEM_ETAPAS = { etapas: [] };
const iniciado = { ...PROGRESSO_INICIAL, iniciada: true };
const depoisDasFixas = { ...iniciado, fixas: true };
const tipo = (pesquisa, progresso) => proximoPasso(pesquisa, progresso).tipo;

describe('proximoPasso', () => {
  it('começa pela abertura e segue para a tela das perguntas fixas', () => {
    expect(tipo(PESQUISA, PROGRESSO_INICIAL)).toBe('abertura');
    expect(tipo(PESQUISA, iniciado)).toBe('fixas');
  });

  it('percorre as perguntas de cada etapa na ordem e depois a nota', () => {
    expect(proximoPasso(PESQUISA, depoisDasFixas)).toMatchObject({
      tipo: 'pergunta',
      etapa: { nome: 'Recepção' },
      pergunta: { id: 10 },
    });
    expect(proximoPasso(PESQUISA, { ...depoisDasFixas, perguntas: [10] }).pergunta.id).toBe(11);
    expect(proximoPasso(PESQUISA, { ...depoisDasFixas, perguntas: [10, 11] }).etapa.nome).toBe(
      'Médico',
    );
    expect(tipo(PESQUISA, { ...depoisDasFixas, perguntas: [10, 11, 20] })).toBe('nota');
    const comNota = { ...depoisDasFixas, perguntas: [10, 11, 20], nota: true };
    expect(tipo(PESQUISA, comNota)).toBe('mensagem');
    expect(tipo(PESQUISA, { ...comNota, mensagem: true })).toBe('fim');
  });

  it('sem etapas, vai direto à nota', () => {
    expect(tipo(SEM_ETAPAS, depoisDasFixas)).toBe('nota');
  });
});

describe('avaliarTelaFixa', () => {
  const vazio = {
    pedirData: true,
    diaEscolhido: false,
    dataValida: false,
    turnoId: null,
    perfil: null,
    tipoAtendimento: null,
  };

  it('sem nada escolhido, não continua (o caminho é o Pular)', () => {
    expect(avaliarTelaFixa(vazio)).toEqual({ dataIncompleta: false, podeContinuar: false });
  });

  it('no celular, dia sem período ou período sem dia bloqueia', () => {
    const base = { ...vazio, perfil: 'PACIENTE', tipoAtendimento: 'SUS' };
    const soDia = { ...base, diaEscolhido: true, dataValida: true };
    expect(avaliarTelaFixa(soDia)).toEqual({ dataIncompleta: true, podeContinuar: false });
    expect(avaliarTelaFixa({ ...base, turnoId: 1 }).podeContinuar).toBe(false);
  });

  it('"Outro dia" sem data preenchida bloqueia', () => {
    const outroDia = {
      ...vazio,
      perfil: 'PACIENTE',
      tipoAtendimento: 'SUS',
      diaEscolhido: true,
      turnoId: 1,
    };
    expect(avaliarTelaFixa(outroDia).dataIncompleta).toBe(true);
  });

  it('dia e período sozinhos não bastam: falta perfil e tipo de atendimento', () => {
    const data = { ...vazio, diaEscolhido: true, dataValida: true, turnoId: 1 };
    expect(avaliarTelaFixa(data).podeContinuar).toBe(false);
  });

  it('só um dos dois (perfil ou tipo de atendimento) não avança, nos dois canais', () => {
    expect(avaliarTelaFixa({ ...vazio, perfil: 'FAMILIAR' }).podeContinuar).toBe(false);
    const tablet = { ...vazio, pedirData: false };
    expect(avaliarTelaFixa({ ...tablet, tipoAtendimento: 'SUS' }).podeContinuar).toBe(false);
  });

  it('perfil e tipo de atendimento juntos avançam, com ou sem data', () => {
    const dois = { ...vazio, perfil: 'FAMILIAR', tipoAtendimento: 'SUS' };
    expect(avaliarTelaFixa(dois).podeContinuar).toBe(true);
    expect(avaliarTelaFixa({ ...dois, pedirData: false }).podeContinuar).toBe(true);
  });
});

describe('montarRespondente (envio numa chamada só)', () => {
  it('junta perfil e tipo de atendimento', () => {
    expect(montarRespondente('FAMILIAR', 'SUS')).toEqual({
      respondente: 'FAMILIAR',
      tipoAtendimento: 'SUS',
    });
  });

  it('manda só o que foi escolhido, sem null', () => {
    expect(montarRespondente(null, 'PARTICULAR')).toEqual({ tipoAtendimento: 'PARTICULAR' });
    expect(montarRespondente('PACIENTE', null)).toEqual({ respondente: 'PACIENTE' });
  });

  it('sem nada escolhido, não manda nada', () => {
    expect(montarRespondente(null, null)).toBeNull();
  });
});

describe('retomada', () => {
  const situacao = (extra) => ({
    atendimentoInformado: false,
    respondenteInformado: false,
    temNota: false,
    respostas: [],
    ...extra,
  });

  it('retoma no meio das perguntas', () => {
    const progresso = progressoDaSituacao(
      situacao({ respostas: [{ perguntaId: 10, pulada: true }] }),
    );
    expect(proximoPasso(PESQUISA, progresso).pergunta.id).toBe(11);
  });

  it('com a data ou o respondente gravados, não repete a tela fixa', () => {
    expect(tipo(PESQUISA, progressoDaSituacao(situacao({ atendimentoInformado: true })))).toBe(
      'pergunta',
    );
    expect(tipo(PESQUISA, progressoDaSituacao(situacao({ respondenteInformado: true })))).toBe(
      'pergunta',
    );
  });

  it('sessão sem nada feito volta à tela fixa', () => {
    expect(tipo(PESQUISA, progressoDaSituacao(situacao()))).toBe('fixas');
  });

  it('com a nota, vai à mensagem', () => {
    expect(tipo(PESQUISA, progressoDaSituacao(situacao({ temNota: true })))).toBe('mensagem');
  });

  it('atualizar a página no agradecimento não volta à mensagem', () => {
    const local = { ...depoisDasFixas, nota: true, notaValor: 9, mensagem: true };
    const progresso = juntarProgresso(local, progressoDaSituacao(situacao({ temNota: true })));
    expect(tipo(PESQUISA, progresso)).toBe('fim');
    expect(progresso.notaValor).toBe(9);
  });

  it('a tela fixa pulada na aba não volta depois de atualizar a página', () => {
    const progresso = juntarProgresso(depoisDasFixas, progressoDaSituacao(situacao()));
    expect(tipo(PESQUISA, progresso)).toBe('pergunta');
  });
});
