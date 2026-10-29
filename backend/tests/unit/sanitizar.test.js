const { sanitizar } = require('../../src/utils/sanitizar');

describe('sanitizar', () => {
  it('remove o <script> e o seu conteúdo', () => {
    expect(sanitizar('<script>alert(1)</script>Atendimento ótimo')).toBe('Atendimento ótimo');
  });

  it('remove tags e atributos, mantendo o texto', () => {
    expect(sanitizar('<b>Muito</b> bom <img src=x onerror=alert(1)>')).toBe('Muito bom');
    expect(sanitizar('<a href="javascript:alert(1)">clique</a>')).toBe('clique');
  });

  it('guarda o texto como a pessoa escreveu, sem &amp; nem &lt;', () => {
    expect(sanitizar('Tom & Jerry: nota 9 > 8 e 2 < 3')).toBe('Tom & Jerry: nota 9 > 8 e 2 < 3');
  });

  it('não deixa uma tag "escondida" em entidades virar tag de verdade', () => {
    expect(sanitizar('&lt;script&gt;alert(1)&lt;/script&gt;oi')).toBe('oi');
    expect(sanitizar('&lt;b&gt;oi&lt;/b&gt;')).toBe('oi');
  });

  it('tira os espaços das pontas e mantém quebras de linha internas', () => {
    expect(sanitizar('  primeira linha\nsegunda linha  ')).toBe('primeira linha\nsegunda linha');
  });

  it('mantém nulo e indefinido como estão', () => {
    expect(sanitizar(null)).toBeNull();
    expect(sanitizar(undefined)).toBeUndefined();
  });
});
