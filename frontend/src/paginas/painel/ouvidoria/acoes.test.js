import { describe, expect, it } from 'vitest';
import {
  fotosDoRegistro,
  montarRegistro,
  podeAnexarFoto,
  podeRegistrarTentativa,
  situacaoDaFinalizacao,
  textoDaConfirmacao,
} from './acoes';

const tentativa = (resultado, id) => ({ id, resultado });
const chamado = (extra = {}) => ({
  status: 'EM_CONTATO',
  tipo: 'RECLAMACAO',
  origem: 'PESQUISA',
  pediuRetorno: true,
  telefone: '5551999999999',
  tentativas: [],
  anexos: [],
  ...extra,
});

describe('finalização do chamado', () => {
  it('"Sem retorno" só habilita com 3 tentativas sem sucesso (RF15)', () => {
    const duas = [tentativa('SEM_SUCESSO', 1), tentativa('SEM_SUCESSO', 2)];
    expect(situacaoDaFinalizacao(chamado({ tentativas: duas })).semRetorno).toEqual({
      aparece: true,
      habilitado: false,
      faltam: 1,
    });

    const tres = [...duas, tentativa('SEM_SUCESSO', 3)];
    expect(situacaoDaFinalizacao(chamado({ tentativas: tres })).semRetorno.habilitado).toBe(true);
  });

  it('contato realizado não conta como tentativa sem sucesso', () => {
    const tentativas = [
      tentativa('SEM_SUCESSO', 1),
      tentativa('SEM_SUCESSO', 2),
      tentativa('CONTATO_REALIZADO', 3),
    ];
    expect(situacaoDaFinalizacao(chamado({ tentativas })).semRetorno.habilitado).toBe(false);
  });

  it('"Sem retorno" nem aparece em chamado anônimo', () => {
    const anonimo = chamado({ pediuRetorno: false, telefone: null });
    expect(situacaoDaFinalizacao(anonimo).semRetorno.aparece).toBe(false);
  });

  it('enquanto "a classificar", a finalização fica bloqueada (RN12)', () => {
    const situacao = situacaoDaFinalizacao(
      chamado({
        tipo: null,
        tentativas: [1, 2, 3].map((n) => tentativa('SEM_SUCESSO', n)),
      }),
    );
    expect(situacao.bloqueio).toMatch(/Classifique/);
    expect(situacao.semRetorno.habilitado).toBe(false);
    expect(situacaoDaFinalizacao(chamado()).bloqueio).toBeNull();
  });

  it('a confirmação avisa do telefone só quando há telefone (RN07)', () => {
    expect(textoDaConfirmacao(chamado())).toBe(
      'O telefone será apagado e o chamado não poderá ser reaberto.',
    );
    expect(textoDaConfirmacao(chamado({ pediuRetorno: false, telefone: null }))).toBe(
      'O chamado não poderá ser reaberto.',
    );
  });
});

describe('o que cada chamado aceita', () => {
  it('tentativa: só chamado aberto com telefone', () => {
    expect(podeRegistrarTentativa(chamado())).toBe(true);
    expect(podeRegistrarTentativa(chamado({ status: 'ENCERRADA' }))).toBe(false);
    expect(podeRegistrarTentativa(chamado({ telefone: null }))).toBe(false);
    expect(podeRegistrarTentativa(chamado({ pediuRetorno: false }))).toBe(false);
  });

  it('foto: só origem PAPEL, aberto e até 3 (RF17)', () => {
    expect(podeAnexarFoto(chamado({ origem: 'PAPEL' }))).toBe(true);
    expect(podeAnexarFoto(chamado({ origem: 'TELEFONE' }))).toBe(false);
    expect(podeAnexarFoto(chamado({ origem: 'PAPEL', status: 'ENCERRADA' }))).toBe(false);
    expect(podeAnexarFoto(chamado({ origem: 'PAPEL', anexos: [{}, {}, {}] }))).toBe(false);
  });
});

describe('corpo do registro de manifestação', () => {
  const base = {
    origem: 'TELEFONE',
    tipo: 'RECLAMACAO',
    setorId: '3',
    dataOcorrencia: '2026-10-30',
    turnoId: '',
    etapaId: '',
    texto: 'Demora na troca de medicação.',
    profissionalCitado: '',
    telefone: '',
    autorizou: false,
  };
  const hoje = '2026-11-05';
  const termo = { id: 4, versao: 4, texto: '...' };

  it('sem telefone, não leva aceite nem termo e omite o que está vazio', () => {
    const { corpo } = montarRegistro(base, termo, hoje);
    expect(corpo).toEqual({
      origem: 'TELEFONE',
      tipo: 'RECLAMACAO',
      setorId: 3,
      dataOcorrencia: '2026-10-30',
      texto: 'Demora na troca de medicação.',
    });
  });

  it('com telefone, leva aceiteTermos e o termoId da versão vigente (RN06)', () => {
    const { corpo } = montarRegistro(
      { ...base, telefone: '(51) 99999-9999', autorizou: true, turnoId: '1', etapaId: '7' },
      termo,
      hoje,
    );
    expect(corpo).toMatchObject({
      telefone: '(51) 99999-9999',
      aceiteTermos: true,
      termoId: 4,
      turnoId: 1,
      etapaId: 7,
    });
  });

  it('telefone sem a caixa de autorização marcada não envia', () => {
    const resultado = montarRegistro({ ...base, telefone: '51999999999' }, termo, hoje);
    expect(resultado.corpo).toBeUndefined();
    expect(resultado.erros.autorizou).toBeDefined();
  });

  it('sem relato e sem telefone não envia', () => {
    const resultado = montarRegistro({ ...base, texto: '   ' }, termo, hoje);
    expect(resultado.corpo).toBeUndefined();
    expect(resultado.erros.texto).toBeDefined();
  });

  it('só com telefone (sem relato) envia', () => {
    const { corpo } = montarRegistro(
      { ...base, texto: '', telefone: '51999999999', autorizou: true },
      termo,
      hoje,
    );
    expect(corpo.texto).toBeUndefined();
    expect(corpo.termoId).toBe(4);
  });

  it('exige origem, tipo, setor e data, e a data não pode ser futura', () => {
    const { erros } = montarRegistro(
      { ...base, origem: '', tipo: '', setorId: '', dataOcorrencia: '2026-12-01' },
      termo,
      hoje,
    );
    expect(Object.keys(erros).sort()).toEqual(['dataOcorrencia', 'origem', 'setorId', 'tipo']);
  });

  it('fotos só acompanham a origem Papel, até 3', () => {
    const fotos = [1, 2, 3, 4].map((n) => `foto${n}`);
    expect(fotosDoRegistro('PAPEL', fotos)).toHaveLength(3);
    expect(fotosDoRegistro('TELEFONE', fotos)).toEqual([]);
  });
});
