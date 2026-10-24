const sanitizeHtml = require('sanitize-html');

// Nenhuma tag e nenhum atributo: só o texto fica. O conteúdo de <script> e <style> é descartado.
const SEM_HTML = { allowedTags: [], allowedAttributes: {} };

// O sanitize-html devolve o texto com &, < e > escapados (&amp;, &lt;, &gt;). Como o React já
// escapa tudo o que exibe, o banco guarda o texto como a pessoa escreveu ("Tom & Jerry"),
// e não "Tom &amp; Jerry".
function desescapar(texto) {
  return texto.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

const MAXIMO_RODADAS = 10;

// Remove todo HTML de um texto livre e tira os espaços das pontas (RNF09).
// Repete até o texto parar de mudar: assim "&lt;b&gt;" digitado de propósito não vira uma
// tag depois de desescapado.
function sanitizar(texto) {
  if (texto === null || texto === undefined) return texto;

  let atual = String(texto);
  for (let rodada = 0; rodada < MAXIMO_RODADAS; rodada++) {
    const limpo = sanitizeHtml(atual, SEM_HTML);
    const desescapado = desescapar(limpo);
    if (desescapado === atual) return atual.trim();
    // Se não estabilizar, fica a versão escapada, que nunca contém tags
    if (rodada === MAXIMO_RODADAS - 1) return limpo.trim();
    atual = desescapado;
  }
  return atual.trim();
}

module.exports = { sanitizar };
