import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroApi, EVENTO_SESSAO_ENCERRADA, guardarToken, lerToken, requisitar } from './cliente';

function respostaJson(status, corpo) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('cliente da API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('envia JSON com o token e monta a consulta sem valores vazios', async () => {
    const fetch = vi.fn().mockResolvedValue(respostaJson(200, { ok: true }));
    vi.stubGlobal('fetch', fetch);
    guardarToken('abc');

    const dados = await requisitar('POST', '/api/setores', {
      corpo: { nome: 'Raio X' },
      consulta: { pagina: 1, setor: '' },
    });

    expect(dados).toEqual({ ok: true });
    const [url, opcoes] = fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/setores\?pagina=1$/);
    expect(opcoes.headers.Authorization).toBe('Bearer abc');
    expect(opcoes.headers['Content-Type']).toBe('application/json');
    expect(opcoes.body).toBe('{"nome":"Raio X"}');
  });

  it('converte o erro da API em ErroApi', async () => {
    const erro = { codigo: 'SETOR_DUPLICADO', mensagem: 'Já existe.', detalhes: ['nome'] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(409, { erro })));

    const falha = await requisitar('GET', '/api/setores').catch((e) => e);

    expect(falha).toBeInstanceOf(ErroApi);
    expect(falha).toMatchObject({
      status: 409,
      codigo: 'SETOR_DUPLICADO',
      mensagem: 'Já existe.',
      detalhes: ['nome'],
    });
  });

  it('em 401 com token, apaga o token e dispara "sessao-encerrada"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respostaJson(401, { erro: { codigo: 'TOKEN_INVALIDO' } })),
    );
    guardarToken('vencido');
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_SESSAO_ENCERRADA, ouvinte);

    await expect(requisitar('GET', '/api/auth/eu')).rejects.toBeInstanceOf(ErroApi);

    expect(lerToken()).toBeNull();
    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVENTO_SESSAO_ENCERRADA, ouvinte);
  });

  it('envia FormData sem Content-Type JSON', async () => {
    const fetch = vi.fn().mockResolvedValue(respostaJson(201, { id: 1 }));
    vi.stubGlobal('fetch', fetch);
    const formulario = new FormData();
    formulario.append('arquivo', new Blob(['x']), 'escala.xlsx');

    await requisitar('POST', '/api/escalas/importacao', { corpo: formulario });

    const [, opcoes] = fetch.mock.calls[0];
    expect(opcoes.body).toBe(formulario);
    expect(opcoes.headers['Content-Type']).toBeUndefined();
  });

  it('sem conexão vira ErroApi SEM_CONEXAO', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(requisitar('GET', '/api/saude')).rejects.toMatchObject({
      status: 0,
      codigo: 'SEM_CONEXAO',
    });
  });
});
