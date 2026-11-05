import { describe, expect, it } from 'vitest';
import { lerFiltros, mesAtual, paraConsulta, paraParametros, periodoDoMes } from './filtros';

describe('filtros da Visão geral na URL', () => {
  it('sem parâmetros, usa o mês atual e nenhum filtro', () => {
    expect(lerFiltros(new URLSearchParams())).toEqual({ mes: mesAtual() });
  });

  it('lê os filtros do endereço (link de "Indicadores" da tela Setores)', () => {
    const filtros = lerFiltros(
      new URLSearchParams(
        'mes=2026-10&setorId=3&etapaId=2&turnoId=1&canal=PAPEL&respondente=FAMILIAR&tipoAtendimento=SUS',
      ),
    );
    expect(filtros).toEqual({
      mes: '2026-10',
      setorId: '3',
      etapaId: '2',
      turnoId: '1',
      canal: 'PAPEL',
      respondente: 'FAMILIAR',
      tipoAtendimento: 'SUS',
    });
  });

  it('ignora valores inválidos', () => {
    const filtros = lerFiltros(
      new URLSearchParams('mes=outubro&setorId=abc&turnoId=0&canal=RADIO&respondente=X'),
    );
    expect(filtros).toEqual({ mes: mesAtual() });
  });

  it('a etapa só vale com setor escolhido', () => {
    expect(lerFiltros(new URLSearchParams('etapaId=2'))).toEqual({ mes: mesAtual() });
  });

  it('faz o caminho de volta, sem o mês atual nem filtros vazios', () => {
    const filtros = { mes: '2026-10', setorId: '3', canal: undefined, turnoId: '' };
    expect(paraParametros(filtros).toString()).toBe('mes=2026-10&setorId=3');
    expect(paraParametros({ mes: mesAtual() }).toString()).toBe('');
  });
});

describe('período da consulta (a API exige inicio e fim)', () => {
  it('manda o primeiro e o último dia do mês', () => {
    expect(periodoDoMes('2026-10')).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' });
    expect(periodoDoMes('2026-02')).toEqual({ inicio: '2026-02-01', fim: '2026-02-28' });
    expect(periodoDoMes('2028-02').fim).toBe('2028-02-29');
  });

  it('troca o mês por inicio e fim e mantém os filtros', () => {
    expect(paraConsulta({ mes: '2026-11', setorId: '1', canal: 'TABLET' })).toEqual({
      inicio: '2026-11-01',
      fim: '2026-11-30',
      setorId: '1',
      canal: 'TABLET',
    });
  });
});
