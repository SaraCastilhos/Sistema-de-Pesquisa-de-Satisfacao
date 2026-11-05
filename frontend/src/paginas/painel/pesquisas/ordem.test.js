import { describe, expect, it } from 'vitest';
import {
  enderecoDaPesquisa,
  idsDepoisDeMover,
  idsDepoisDeMoverPara,
  mover,
  moverPara,
  montarEtapas,
  pesquisaTemPerguntas,
} from './ordem';
import { nomeDoArquivoQr } from './qrcode';

const ETAPAS = [{ id: 10 }, { id: 20, ativo: false }, { id: 30 }];

describe('ordem das listas', () => {
  it('subir troca com o anterior e a lista enviada à API leva TODAS as etapas', () => {
    expect(idsDepoisDeMover(ETAPAS, 2, -1)).toEqual([10, 30, 20]);
  });

  it('descer troca com o seguinte, inclusive com etapas desativadas', () => {
    expect(idsDepoisDeMover(ETAPAS, 0, +1)).toEqual([20, 10, 30]);
  });

  it('nas pontas nada muda e a lista original não é alterada', () => {
    expect(mover(ETAPAS, 0, -1)).toBe(ETAPAS);
    expect(mover(ETAPAS, 2, +1)).toBe(ETAPAS);
    mover(ETAPAS, 0, +1);
    expect(ETAPAS.map((e) => e.id)).toEqual([10, 20, 30]);
  });
});

describe('arrastar e soltar', () => {
  it('leva o item para a posição de destino, em qualquer distância', () => {
    expect(idsDepoisDeMoverPara(ETAPAS, 0, 2)).toEqual([20, 30, 10]);
    expect(idsDepoisDeMoverPara(ETAPAS, 2, 0)).toEqual([30, 10, 20]);
    expect(idsDepoisDeMoverPara(ETAPAS, 1, 2)).toEqual([10, 30, 20]);
  });

  it('soltar no mesmo lugar ou fora da lista não muda nada', () => {
    expect(moverPara(ETAPAS, 1, 1)).toBe(ETAPAS);
    expect(moverPara(ETAPAS, 0, 5)).toBe(ETAPAS);
    expect(moverPara(ETAPAS, -1, 0)).toBe(ETAPAS);
  });
});

describe('montarEtapas', () => {
  it('junta exibirTvWall das etapas com as perguntas, na ordem da etapa', () => {
    const etapas = [
      { id: 2, nome: 'B', ordem: 2, exibirTvWall: true },
      { id: 1, nome: 'A', ordem: 1, exibirTvWall: false },
    ];
    const grupos = [
      { id: 1, perguntas: [{ id: 5 }] },
      { id: 2, perguntas: [] },
    ];
    expect(montarEtapas(etapas, grupos)).toEqual([
      { id: 1, nome: 'A', ordem: 1, exibirTvWall: false, perguntas: [{ id: 5 }] },
      { id: 2, nome: 'B', ordem: 2, exibirTvWall: true, perguntas: [] },
    ]);
  });

  it('etapa sem grupo de perguntas fica com lista vazia', () => {
    expect(montarEtapas([{ id: 1, ordem: 1 }], [])[0].perguntas).toEqual([]);
  });
});

describe('pesquisaTemPerguntas (RF06)', () => {
  it('só conta pergunta ativa de etapa ativa', () => {
    expect(pesquisaTemPerguntas([{ ativo: true, perguntas: [{ ativa: true }] }])).toBe(true);
    expect(pesquisaTemPerguntas([{ ativo: true, perguntas: [{ ativa: false }] }])).toBe(false);
    expect(pesquisaTemPerguntas([{ ativo: false, perguntas: [{ ativa: true }] }])).toBe(false);
    expect(pesquisaTemPerguntas([])).toBe(false);
  });
});

describe('endereço e QR Code', () => {
  it('monta o endereço da pesquisa e o nome do arquivo', () => {
    expect(enderecoDaPesquisa('pronto-atendimento', 'https://hospital.exemplo')).toBe(
      'https://hospital.exemplo/pesquisa/pronto-atendimento',
    );
    expect(nomeDoArquivoQr('pronto-atendimento')).toBe('qr-pronto-atendimento.png');
  });
});
