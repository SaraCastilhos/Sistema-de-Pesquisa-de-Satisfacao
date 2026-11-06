import { useRef } from 'react';
import { Camera } from 'lucide-react';
import { Botao } from '../../../componentes';

/** Botão "Anexar foto": abre o seletor de imagens (câmera ou galeria no celular) e entrega os arquivos. */
export default function BotaoFoto({
  aoEscolher,
  carregando,
  disabled,
  multiplo = false,
  children,
}) {
  const entrada = useRef(null);

  function aoMudar(evento) {
    const arquivos = [...evento.target.files];
    evento.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (arquivos.length > 0) aoEscolher(arquivos);
  }

  return (
    <>
      <Botao
        variante="secundario"
        icone={Camera}
        carregando={carregando}
        disabled={disabled}
        onClick={() => entrada.current.click()}
      >
        {children ?? 'Anexar foto'}
      </Botao>
      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiplo}
        hidden
        onChange={aoMudar}
        data-testid="entrada-foto"
      />
    </>
  );
}
