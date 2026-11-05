import estilos from './FormulariosPapel.module.css';

/**
 * Uma escolha entre poucas opções (os rostinhos, a nota), com "Em branco" já marcado como no
 * papel. `valor` null = em branco. As opções são botões de opção de verdade: o teclado e o
 * leitor de tela funcionam como em qualquer grupo de rádio.
 */
export default function Escolha({ nome, opcoes, valor, aoMudar }) {
  const todas = [...opcoes, { valor: null, rotulo: 'Em branco' }];
  return (
    <div className={estilos.escolha}>
      {todas.map(({ valor: valorDaOpcao, rotulo, Icone }) => (
        <label key={rotulo} className={estilos.opcao}>
          <input
            type="radio"
            name={nome}
            className="somente-leitor"
            checked={valor === valorDaOpcao}
            onChange={() => aoMudar(valorDaOpcao)}
          />
          <span className={valorDaOpcao === null ? estilos.opcaoBranco : undefined}>
            {Icone && <Icone aria-hidden="true" />}
            {rotulo}
          </span>
        </label>
      ))}
    </div>
  );
}
