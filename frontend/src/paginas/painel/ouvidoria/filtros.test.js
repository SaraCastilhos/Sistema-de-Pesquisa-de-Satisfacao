import { describe, expect, it } from 'vitest';
import {
  comFiltro,
  lerFiltros,
  numeroDoProtocolo,
  paraConsulta,
  paraParametros,
  TAMANHO_PAGINA,
} from './filtros';

describe('filtros da Ouvidoria na URL', () => {
  it('sem parâmetros, só a primeira página', () => {
    expect(lerFiltros(new URLSearchParams())).toEqual({ pagina: 1 });
  });

  it('lê todos os filtros do endereço', () => {
    const filtros = lerFiltros(
      new URLSearchParams(
        'protocolo=248&status=EM_CONTATO&tipo=A_CLASSIFICAR&setorId=3&turnoId=1&inicio=2026-10-01&fim=2026-10-31&pagina=2',
      ),
    );
    expect(filtros).toEqual({
      protocolo: '248',
      status: 'EM_CONTATO',
      tipo: 'A_CLASSIFICAR',
      setorId: '3',
      turnoId: '1',
      inicio: '2026-10-01',
      fim: '2026-10-31',
      pagina: 2,
    });
  });

  it('ignora valores inválidos', () => {
    const filtros = lerFiltros(
      new URLSearchParams(
        'status=ABERTA&tipo=outro&setorId=abc&turnoId=0&protocolo=-3&inicio=2026-13-40&fim=ontem&pagina=0',
      ),
    );
    expect(filtros).toEqual({ pagina: 1 });
  });

  it('descarta o fim de um período ao contrário', () => {
    const filtros = lerFiltros(new URLSearchParams('inicio=2026-10-20&fim=2026-10-01'));
    expect(filtros).toEqual({ inicio: '2026-10-20', pagina: 1 });
  });

  it('faz o caminho de volta, sem filtros vazios nem a página 1', () => {
    const filtros = { status: 'NOVA', tipo: '', setorId: '3', turnoId: undefined, pagina: 1 };
    expect(paraParametros(filtros).toString()).toBe('status=NOVA&setorId=3');
    expect(paraParametros({ ...filtros, pagina: 3 }).toString()).toBe(
      'status=NOVA&setorId=3&pagina=3',
    );
    expect(paraParametros({ pagina: 1 }).toString()).toBe('');
  });

  it('ler o que foi escrito devolve os mesmos filtros', () => {
    const filtros = { tipo: 'A_CLASSIFICAR', protocolo: '12', fim: '2026-10-31', pagina: 4 };
    expect(lerFiltros(paraParametros(filtros))).toEqual(filtros);
  });

  it('a consulta da API leva o tamanho da página', () => {
    expect(paraConsulta({ status: 'NOVA', pagina: 2 })).toEqual({
      status: 'NOVA',
      pagina: 2,
      tamanho: TAMANHO_PAGINA,
    });
  });

  it('trocar um filtro volta para a primeira página e limpar tira o filtro', () => {
    expect(comFiltro({ status: 'NOVA', pagina: 3 }, 'tipo', 'ELOGIO')).toEqual({
      status: 'NOVA',
      tipo: 'ELOGIO',
      pagina: 1,
    });
    expect(paraParametros(comFiltro({ status: 'NOVA', pagina: 3 }, 'status', '')).toString()).toBe(
      '',
    );
  });
});

describe('numeroDoProtocolo', () => {
  it.each([
    ['248', '248'],
    ['OUV-0248', '248'],
    ['ouv 248', '248'],
    ['  12 ', '12'],
  ])('"%s" → %s', (texto, esperado) => {
    expect(numeroDoProtocolo(texto)).toBe(esperado);
  });

  it.each(['', 'abc', '0', '-4', 'OUV-', '1,5'])('"%s" não é protocolo', (texto) => {
    expect(numeroDoProtocolo(texto)).toBeNull();
  });
});
