import { describe, expect, it } from 'vitest';
import { agruparEscala, mesesDaEscala, rotuloDoDia } from './grade';
import { mensagemDeSucesso, resumoDoErro } from './importacao';
import { validarQuantidade } from './quantidade';

describe('resumoDoErro (importação da escala)', () => {
  it('monta a tabela de linhas a corrigir a partir do 422 ESCALA_COM_ERROS', () => {
    const resumo = resumoDoErro({
      codigo: 'ESCALA_COM_ERROS',
      mensagem: 'A planilha tem 2 problemas a corrigir. Nada foi gravado.',
      detalhes: [
        { campo: 'arquivo', linha: 3, mensagem: 'Equipe "Z" não cadastrada.' },
        { campo: 'arquivo', linha: 9, mensagem: 'Turno "Tarde" não encontrado.' },
        { campo: 'arquivo', mensagem: 'Mais 12 problemas não foram listados.' },
      ],
    });
    expect(resumo.tipo).toBe('linhas');
    expect(resumo.mensagem).toMatch(/Nada foi gravado/);
    expect(resumo.linhas).toEqual([
      { id: 1, linha: 3, mensagem: 'Equipe "Z" não cadastrada.' },
      { id: 2, linha: 9, mensagem: 'Turno "Tarde" não encontrado.' },
    ]);
    expect(resumo.avisos).toEqual(['Mais 12 problemas não foram listados.']);
  });

  it.each(['PLANILHA_VAZIA', 'PLANILHA_FORA_DO_MODELO', 'ARQUIVO_GRANDE_DEMAIS'])(
    '%s mostra só a mensagem da API',
    (codigo) => {
      expect(resumoDoErro({ codigo, mensagem: 'Texto da API.', detalhes: [{ linha: 1 }] })).toEqual(
        {
          tipo: 'mensagem',
          mensagem: 'Texto da API.',
        },
      );
    },
  );

  it('sem detalhes, a tabela fica vazia', () => {
    expect(resumoDoErro({ codigo: 'ESCALA_COM_ERROS', mensagem: 'x' }).linhas).toEqual([]);
  });
});

describe('mensagemDeSucesso', () => {
  it('cita as linhas, os setores e o que foi substituído', () => {
    expect(
      mensagemDeSucesso({ setores: ['Raio X', 'Endoscopia'], linhas: 60, substituidas: 1 }),
    ).toBe('Escala gravada: 60 linhas em Raio X, Endoscopia. 1 linha anterior foi substituída.');
    expect(mensagemDeSucesso({ setores: ['Raio X'], linhas: 1, substituidas: 0 })).toBe(
      'Escala gravada: 1 linha em Raio X.',
    );
  });
});

describe('validarQuantidade (atendimentos)', () => {
  it('aceita inteiro de 1 em diante', () => {
    expect(validarQuantidade('1250')).toEqual({ valor: 1250, erro: null });
    expect(validarQuantidade(' 7 ')).toEqual({ valor: 7, erro: null });
  });

  it('vazio não é válido, mas também não mostra erro', () => {
    expect(validarQuantidade('')).toEqual({ valor: null, erro: null });
    expect(validarQuantidade('   ')).toEqual({ valor: null, erro: null });
  });

  it('recusa 0, decimal, texto e acima do limite', () => {
    expect(validarQuantidade('0').valor).toBeNull();
    expect(validarQuantidade('0').erro).toMatch(/1 atendimento/);
    expect(validarQuantidade('12,5').erro).toMatch(/inteiros/);
    expect(validarQuantidade('12.5').erro).toMatch(/inteiros/);
    expect(validarQuantidade('-3').erro).toMatch(/inteiros/);
    expect(validarQuantidade('abc').erro).toMatch(/inteiros/);
    expect(validarQuantidade('10000001').erro).toMatch(/máximo/);
  });
});

describe('agruparEscala', () => {
  const equipe = (nome) => ({ id: 1, nome });
  const linha = (data, setor, turno, nomeEquipe) => ({
    data,
    setor,
    turno,
    equipe: equipe(nomeEquipe),
  });
  const PA = { id: 3, nome: 'Pronto Atendimento' };
  const RX = { id: 4, nome: 'Raio X' };
  const DIA = { id: 1, nome: 'Dia' };
  const NOITE = { id: 2, nome: 'Noite' };

  it('agrupa por setor, com uma linha por dia e uma coluna por turno', () => {
    const grupos = agruparEscala([
      linha('2026-10-01', PA, DIA, 'A'),
      linha('2026-10-01', PA, NOITE, 'B'),
      linha('2026-10-01', RX, DIA, 'C'),
      linha('2026-10-02', PA, DIA, 'B'),
    ]);
    expect(grupos.map((g) => g.setor.nome)).toEqual(['Pronto Atendimento', 'Raio X']);
    const [pa, rx] = grupos;
    expect(pa.turnos.map((t) => t.nome)).toEqual(['Dia', 'Noite']);
    expect(pa.dias.map((d) => d.id)).toEqual(['2026-10-01', '2026-10-02']);
    expect(pa.dias[0].celulas).toEqual({ 1: 'A', 2: 'B' });
    expect(pa.dias[1].celulas).toEqual({ 1: 'B' });
    expect(rx.dias).toHaveLength(1);
  });

  it('sem linhas, não há grupos', () => {
    expect(agruparEscala([])).toEqual([]);
  });
});

describe('rotuloDoDia e mesesDaEscala', () => {
  it('mostra o dia da semana e a data', () => {
    expect(rotuloDoDia('2026-10-14')).toBe('qua 14/10');
  });

  it('a lista de meses começa no próximo e inclui os últimos 12', () => {
    const meses = mesesDaEscala('2026-12');
    expect(meses[0]).toBe('2027-01');
    expect(meses[1]).toBe('2026-12');
    expect(meses).toHaveLength(13);
  });
});
