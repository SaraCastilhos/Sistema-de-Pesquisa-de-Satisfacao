import { describe, expect, it } from 'vitest';
import {
  aposSalvar,
  estadoInicial,
  gruposDeEtapas,
  manterSoPerguntasDoSetor,
  montarCorpo,
  podeSalvar,
  preencher,
  resumo,
} from './formulario';

const HOJE = '2026-11-05';

const preenchido = (mudancas = {}) => ({
  ...estadoInicial(HOJE),
  data: '2026-10-28',
  setorId: '3',
  ...mudancas,
});

describe('montarCorpo', () => {
  it('manda data, turno, cabeçalho, só os itens marcados e a nota', () => {
    const corpo = montarCorpo(
      preenchido({
        turnoId: '1',
        respondente: 'PACIENTE',
        tipoAtendimento: 'SUS',
        respostas: { 2: 4, 1: 5 },
        nota: 9,
      }),
    );
    expect(corpo).toEqual({
      setorId: 3,
      data: '2026-10-28',
      turnoId: 1,
      respondente: 'PACIENTE',
      tipoAtendimento: 'SUS',
      respostas: [
        { perguntaId: 1, valor: 5 },
        { perguntaId: 2, valor: 4 },
      ],
      nota: 9,
    });
  });

  it('sem data no papel, manda dataEstimada e não manda data', () => {
    const corpo = montarCorpo(preenchido({ semData: true, nota: 7 }));
    expect(corpo.dataEstimada).toBe('2026-10-28');
    expect(corpo).not.toHaveProperty('data');
  });

  it('turno, quem respondeu e tipo "Não informado" não vão no corpo', () => {
    const corpo = montarCorpo(preenchido({ nota: 7 }));
    expect(corpo).not.toHaveProperty('turnoId');
    expect(corpo).not.toHaveProperty('respondente');
    expect(corpo).not.toHaveProperty('tipoAtendimento');
  });

  it('nota em branco não vai; a nota 0 vai', () => {
    expect(montarCorpo(preenchido({ respostas: { 1: 3 } }))).not.toHaveProperty('nota');
    expect(montarCorpo(preenchido({ nota: 0 })).nota).toBe(0);
  });
});

describe('podeSalvar', () => {
  it('bloqueia o formulário todo em branco', () => {
    expect(podeSalvar(preenchido(), HOJE)).toBe(false);
  });

  it('libera com um rostinho ou com a nota', () => {
    expect(podeSalvar(preenchido({ respostas: { 1: 2 } }), HOJE)).toBe(true);
    expect(podeSalvar(preenchido({ nota: 0 }), HOJE)).toBe(true);
  });

  it('bloqueia sem setor, sem data e com data futura', () => {
    expect(podeSalvar(preenchido({ nota: 5, setorId: '' }), HOJE)).toBe(false);
    expect(podeSalvar(preenchido({ nota: 5, data: '' }), HOJE)).toBe(false);
    expect(podeSalvar(preenchido({ nota: 5, data: '2026-11-06' }), HOJE)).toBe(false);
    expect(podeSalvar(preenchido({ nota: 5, data: HOJE }), HOJE)).toBe(true);
  });
});

describe('preencher', () => {
  const detalhe = {
    id: '9b2f6c1e-4a7d-4e2b-8f3a-1c5d7e9a0b24',
    setor: { id: 3, nome: 'Pronto Atendimento' },
    dataAtendimento: '2026-10-28',
    turnoOrigem: 'INFORMADO',
    turno: { id: 1, nome: 'Dia' },
    respondente: 'FAMILIAR',
    tipoAtendimento: null,
    nota: 8,
    respostas: [
      { perguntaId: 1, valor: 5 },
      { perguntaId: 2, valor: 4 },
    ],
  };

  it('devolve o estado do formulário digitado', () => {
    expect(preencher(detalhe)).toEqual({
      data: '2026-10-28',
      semData: false,
      turnoId: '1',
      respondente: 'FAMILIAR',
      tipoAtendimento: '',
      setorId: '3',
      respostas: { 1: 5, 2: 4 },
      nota: 8,
    });
  });

  it('data estimada e sem turno: marca "veio sem data" e deixa o turno em branco', () => {
    const estado = preencher({ ...detalhe, turnoOrigem: 'ESTIMADO', turno: null, nota: null });
    expect(estado.semData).toBe(true);
    expect(estado.turnoId).toBe('');
    expect(estado.nota).toBeNull();
  });

  it('corrigir manda o formulário inteiro, igual ao que foi aberto', () => {
    expect(montarCorpo(preencher(detalhe))).toEqual({
      setorId: 3,
      data: '2026-10-28',
      turnoId: 1,
      respondente: 'FAMILIAR',
      respostas: detalhe.respostas,
      nota: 8,
    });
  });
});

describe('gruposDeEtapas', () => {
  it('tira as etapas desativadas e as que ficaram sem pergunta', () => {
    const etapas = [
      { id: 1, nome: 'Recepção', ativo: true, perguntas: [{ id: 1, texto: 'a' }] },
      { id: 2, nome: 'Triagem', ativo: true, perguntas: [] },
      { id: 3, nome: 'Exame', ativo: false, perguntas: [{ id: 3, texto: 'c' }] },
    ];
    expect(gruposDeEtapas(etapas).map((g) => g.nome)).toEqual(['Recepção']);
  });
});

describe('manterSoPerguntasDoSetor', () => {
  const grupos = [{ id: 1, nome: 'Recepção', perguntas: [{ id: 1 }, { id: 2 }] }];

  it('descarta o que já não está na lista do setor', () => {
    expect(manterSoPerguntasDoSetor({ 1: 5, 9: 3 }, grupos)).toEqual({ 1: 5 });
  });

  it('devolve o mesmo objeto quando nada muda', () => {
    const respostas = { 1: 5 };
    expect(manterSoPerguntasDoSetor(respostas, grupos)).toBe(respostas);
  });
});

describe('aposSalvar', () => {
  it('limpa tudo, menos o setor e a data', () => {
    const depois = aposSalvar(
      preenchido({ turnoId: '1', respondente: 'PACIENTE', respostas: { 1: 3 }, nota: 4 }),
      HOJE,
    );
    expect(depois).toEqual({ ...estadoInicial(HOJE), setorId: '3', data: '2026-10-28' });
  });
});

describe('resumo', () => {
  const formatar = (data) => data;

  it('mostra setor, data, itens e nota', () => {
    const texto = resumo(
      preenchido({ respostas: { 1: 3, 2: 4 }, nota: 9 }),
      'Pronto Atendimento',
      formatar,
    );
    expect(texto).toBe('Pronto Atendimento · 2026-10-28 · 2 itens marcados · nota 9');
  });

  it('singular, sem nota e data de recolhimento', () => {
    const texto = resumo(preenchido({ respostas: { 1: 3 }, semData: true }), 'Raio-X', formatar);
    expect(texto).toBe('Raio-X · recolhido em 2026-10-28 · 1 item marcado · sem nota');
  });
});
