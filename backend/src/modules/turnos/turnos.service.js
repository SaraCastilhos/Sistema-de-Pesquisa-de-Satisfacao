const { AppError } = require('../../utils/AppError');
const { paraHoraBanco, deHoraBanco } = require('../../utils/datas');
const { validarGrade } = require('../../utils/gradeTurnos');

// Campos que o Super Admin pode mudar em um turno, na ordem em que são comparados
const CAMPOS_EDITAVEIS = ['nome', 'horaInicio', 'horaFim', 'ativo'];

// O banco guarda TIME (1970-01-01 em UTC); a API e o log usam 'HH:MM'
function formatar(turno) {
  return {
    ...turno,
    horaInicio: deHoraBanco(turno.horaInicio),
    horaFim: deHoraBanco(turno.horaFim),
  };
}

// Nome que só existe dentro da transação de salvarGrade; o id o torna único
function nomeProvisorio(id) {
  return `~renomeando-${id}~`;
}

function paraBanco(dados) {
  return {
    ...dados,
    ...(dados.horaInicio !== undefined && { horaInicio: paraHoraBanco(dados.horaInicio) }),
    ...(dados.horaFim !== undefined && { horaFim: paraHoraBanco(dados.horaFim) }),
  };
}

// Dependências recebidas por parâmetro (seção 5 da arquitetura): nos testes unitários,
// cada uma é trocada por uma versão falsa, sem banco.
function criarTurnosService({ turnosRepository, auditoriaRepository, prisma, versaoDados }) {
  // Super Admin e Gestor veem a mesma grade: turnos não pertencem a setores
  async function listar({ ativo } = {}) {
    const turnos = await turnosRepository.listar({ ativo });
    return turnos.map(formatar);
  }

  // Recebe a grade inteira e grava tudo numa transação, só se a nova grade ativa cobrir as
  // 24 horas sem sobreposição (D2). Regras:
  //   - item com id altera o turno; item sem id cria um turno novo;
  //   - turno ativo que não veio na lista é desativado (a lista é a grade inteira);
  //   - nada é apagado (D6): sair da grade é ficar com ativo = false.
  // A sessão guarda o turno, e não o horário: mudar o horário vale só para sessões novas (D13).
  async function salvarGrade({ turnos }, usuario) {
    const mudou = await prisma.$transaction(async (tx) => {
      const atuais = new Map(
        (await turnosRepository.listar({}, tx)).map((turno) => [turno.id, formatar(turno)]),
      );

      const desconhecidos = turnos.filter((turno) => turno.id && !atuais.has(turno.id));
      if (desconhecidos.length > 0) {
        throw new AppError(
          404,
          'TURNO_NAO_ENCONTRADO',
          'Turno não encontrado.',
          desconhecidos.map((turno) => ({
            campo: 'body.turnos',
            mensagem: `Não existe turno com id ${turno.id}.`,
          })),
        );
      }

      const enviados = new Set(turnos.map((turno) => turno.id).filter(Boolean));
      const omitidos = [...atuais.values()]
        .filter((turno) => turno.ativo && !enviados.has(turno.id))
        .map((turno) => ({ ...turno, ativo: false }));
      const novaGrade = [...turnos, ...omitidos];

      const { valida, problemas } = validarGrade(novaGrade);
      if (!valida) {
        throw new AppError(
          422,
          'GRADE_DE_TURNOS_INVALIDA',
          'Os turnos ativos precisam cobrir as 24 horas do dia, sem sobreposição.',
          problemas.map((mensagem) => ({ campo: 'body.turnos', mensagem })),
        );
      }

      // Os turnos existentes são gravados antes dos novos: assim, renomear o "Noite" antigo
      // e criar um "Noite" novo na mesma grade não esbarra no nome único.
      const existentes = novaGrade.filter((turno) => turno.id);
      const novos = novaGrade.filter((turno) => !turno.id);
      let alterou = false;

      // Troca de nomes entre turnos (Manhã vira "Tarde" e Tarde vira "Manhã"): gravados um de
      // cada vez, o primeiro esbarraria no nome único, porque o segundo ainda tem o nome antigo.
      // Por isso, quem muda de nome ganha antes um nome provisório e único, dentro da mesma
      // transação. O log registra só o nome de antes e o de depois.
      const renomeados = existentes.filter((item) => item.nome !== atuais.get(item.id).nome);
      for (const item of renomeados) {
        await turnosRepository.atualizar(item.id, { nome: nomeProvisorio(item.id) }, tx);
      }

      for (const item of existentes) {
        const antes = atuais.get(item.id);
        const dados = Object.fromEntries(
          CAMPOS_EDITAVEIS.filter((campo) => item[campo] !== antes[campo]).map((campo) => [
            campo,
            item[campo],
          ]),
        );
        if (Object.keys(dados).length === 0) continue;

        const depois = formatar(await turnosRepository.atualizar(item.id, paraBanco(dados), tx));
        await auditoriaRepository.registrar(
          {
            usuarioId: usuario.id,
            acao: antes.ativo && dados.ativo === false ? 'DESATIVACAO' : 'ALTERACAO',
            entidade: 'turno',
            entidadeId: item.id,
            antes,
            depois,
          },
          tx,
        );
        alterou = true;
      }

      for (const item of novos) {
        const { nome, horaInicio, horaFim, ativo } = item;
        const criado = formatar(
          await turnosRepository.criar(paraBanco({ nome, horaInicio, horaFim, ativo }), tx),
        );
        await auditoriaRepository.registrar(
          {
            usuarioId: usuario.id,
            acao: 'CRIACAO',
            entidade: 'turno',
            entidadeId: criado.id,
            depois: criado,
          },
          tx,
        );
        alterou = true;
      }

      return alterou;
    });

    // O turno é filtro do dashboard: o cache dos indicadores precisa recalcular (seção 8)
    if (mudou) versaoDados.incrementar();
    return listar();
  }

  return { listar, salvarGrade };
}

module.exports = { criarTurnosService };
