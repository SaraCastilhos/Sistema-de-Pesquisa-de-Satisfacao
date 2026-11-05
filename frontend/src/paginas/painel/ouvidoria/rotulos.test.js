import { describe, expect, it } from 'vitest';
import {
  formatarProtocolo,
  formatarTelefone,
  rotuloOrigem,
  rotuloRetorno,
  rotuloTentativas,
  seloStatus,
  seloTipo,
  textoDoContato,
  varianteNota,
} from './rotulos';
import { STATUS, TIPOS } from './filtros';

describe('selo de status', () => {
  it.each([
    ['NOVA', 'Nova', 'perigo'],
    ['EM_CONTATO', 'Em contato', 'atencao'],
    ['ENCERRADA', 'Encerrada', 'sucesso'],
    ['SEM_RETORNO', 'Sem retorno', 'neutro'],
  ])('%s → "%s" (%s)', (status, rotulo, variante) => {
    expect(seloStatus(status)).toEqual({ rotulo, variante });
  });

  it('cobre todos os status do filtro, com o mesmo nome', () => {
    for (const { valor, rotulo } of STATUS) expect(seloStatus(valor).rotulo).toBe(rotulo);
  });
});

describe('selo de tipo', () => {
  it('sem tipo, mostra o selo "A classificar"', () => {
    expect(seloTipo(null)).toEqual({ rotulo: 'A classificar', variante: 'info' });
  });

  it.each([
    ['ELOGIO', 'Elogio'],
    ['RECLAMACAO', 'Reclamação'],
    ['SUGESTAO', 'Sugestão'],
  ])('%s vira o texto "%s", sem selo', (tipo, rotulo) => {
    expect(seloTipo(tipo)).toEqual({ rotulo, variante: null });
  });

  it('cobre todos os tipos do filtro, com o mesmo nome', () => {
    for (const { valor, rotulo } of TIPOS.filter((t) => t.valor !== 'A_CLASSIFICAR')) {
      expect(seloTipo(valor).rotulo).toBe(rotulo);
    }
  });
});

describe('combinações de status e tipo', () => {
  const statusLista = ['NOVA', 'EM_CONTATO', 'ENCERRADA', 'SEM_RETORNO'];
  const tiposLista = [null, 'ELOGIO', 'RECLAMACAO', 'SUGESTAO'];

  it('cada combinação tem rótulo de status e de tipo, sem um interferir no outro', () => {
    for (const status of statusLista) {
      for (const tipo of tiposLista) {
        const doStatus = seloStatus(status);
        const doTipo = seloTipo(tipo);
        expect(doStatus.rotulo).toBeTruthy();
        expect(doStatus.variante).toBeTruthy();
        expect(doTipo.rotulo).toBeTruthy();
        // Só "A classificar" ganha selo
        expect(doTipo.variante === null).toBe(tipo !== null);
      }
    }
  });
});

describe('textos do chamado', () => {
  it('protocolo com quatro dígitos', () => {
    expect(formatarProtocolo(248)).toBe('OUV-0248');
    expect(formatarProtocolo(5)).toBe('OUV-0005');
    expect(formatarProtocolo(12345)).toBe('OUV-12345');
  });

  it('origem, retorno e tentativas', () => {
    expect(rotuloOrigem('PESQUISA')).toBe('Pesquisa digital');
    expect(rotuloOrigem('EMAIL')).toBe('E-mail');
    expect(rotuloRetorno(true)).toBe('Solicitado');
    expect(rotuloRetorno(false)).toBe('Anônimo');
    expect(rotuloTentativas(0)).toBe('0 tentativas');
    expect(rotuloTentativas(1)).toBe('1 tentativa');
    expect(rotuloTentativas(3)).toBe('3 tentativas');
  });

  it('cor da nota', () => {
    expect(varianteNota(10)).toBe('sucesso');
    expect(varianteNota(7)).toBe('sucesso');
    expect(varianteNota(6)).toBe('atencao');
    expect(varianteNota(5)).toBe('atencao');
    expect(varianteNota(4)).toBe('perigo');
    expect(varianteNota(0)).toBe('perigo');
    expect(varianteNota(null)).toBe('neutro');
  });
});

describe('formatarTelefone', () => {
  it('celular com o 55 do país', () => {
    expect(formatarTelefone('5551999999999')).toBe('(51) 99999-9999');
  });

  it('fixo com o 55 do país', () => {
    expect(formatarTelefone('555133334444')).toBe('(51) 3333-4444');
  });

  it('sem o 55', () => {
    expect(formatarTelefone('51999999999')).toBe('(51) 99999-9999');
  });

  it('o que não for telefone volta como veio', () => {
    expect(formatarTelefone('123')).toBe('123');
    expect(formatarTelefone(null)).toBe('');
  });
});

describe('textoDoContato', () => {
  it('anônimo quando não pediu retorno', () => {
    expect(textoDoContato({ pediuRetorno: false, telefone: null })).toBe('Anônimo');
  });

  it('telefone formatado quando pediu retorno', () => {
    expect(textoDoContato({ pediuRetorno: true, telefone: '5551999999999' })).toBe(
      '(51) 99999-9999',
    );
  });

  it('avisa que o telefone foi apagado depois da finalização (RN07)', () => {
    expect(textoDoContato({ pediuRetorno: true, telefone: null })).toBe(
      'Telefone apagado no encerramento',
    );
  });
});
