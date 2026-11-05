/** Regras puras da tela de mensagem (RF08, RF10, RN06). */
import { NOTA_MAXIMA_OUVIDORIA } from '../../utils/regras';

/** Mesma regra de backend/src/utils/telefone.js: é o que a API aceita. */
export function telefoneValido(texto) {
  let digitos = String(texto ?? '').replace(/\D/g, '');
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
    digitos = digitos.slice(2);
  }
  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  const celular = numero.length === 9 && numero.startsWith('9');
  const fixo = numero.length === 8 && /^[2-5]/.test(numero);
  return /^[1-9]{2}$/.test(ddd) && (celular || fixo);
}

/**
 * Decide o que o "Enviar" faz. Devolve { acao }, sendo acao:
 * 'confirmarVazio', 'pedirAutorizacao', 'telefoneInvalido' ou 'enviar' (com texto e telefone,
 * cada um null quando não vai). Pedir retorno sem informar o telefone conta como sem telefone.
 */
export function decidirEnvio({ texto, querRetorno, telefone, autorizou }) {
  const textoLimpo = (texto ?? '').trim();
  const telefoneLimpo = querRetorno ? (telefone ?? '').trim() : '';

  if (!textoLimpo && !telefoneLimpo) return { acao: 'confirmarVazio' };
  if (telefoneLimpo && !autorizou) return { acao: 'pedirAutorizacao' };
  if (telefoneLimpo && !telefoneValido(telefoneLimpo)) return { acao: 'telefoneInvalido' };
  return { acao: 'enviar', texto: textoLimpo || null, telefone: telefoneLimpo || null };
}

/** Final da pesquisa pela nota. Sem a nota (retomada em outra aba), vale o texto geral. */
export function finalPelaNota(nota) {
  return nota !== null && nota !== undefined && nota > NOTA_MAXIMA_OUVIDORIA
    ? 'elogio'
    : 'ouvidoria';
}
