// Chave de comparação de nomes cadastrados (setor, turno, etapa e equipe) no JavaScript, com a
// mesma regra da collation ignora_maiusculas_e_acentos do banco (D16 do modelo, RN13):
// "Recepção", " recepcao " e "RECEPÇÃO" dão a mesma chave; "Raio-X" e "Raio X", não.
//
// Use quando a comparação é feita em memória, como na importação da escala, que confere
// centenas de linhas contra os cadastros lidos uma vez só. Consultas ao banco não precisam
// dela: o "=" da coluna já ignora maiúsculas e acentos.
function chaveDeNome(nome) {
  return (
    String(nome)
      .trim()
      // Separa cada letra do seu acento ("ç" vira "c" + cedilha) e descarta os acentos
      .normalize('NFD')
      .replace(/\p{Mark}/gu, '')
      .toLocaleLowerCase('pt-BR')
  );
}

module.exports = { chaveDeNome };
