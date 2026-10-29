# Documento de Requisitos do Sistema — Pesquisa de Satisfação FHDOD

**Cliente:** Fundação Hospitalar Dr. Oswaldo Diesel (FHDOD), Três Coroas/RS — Ouvidoria
**Responsáveis:** Maria Luiza Altenhofen Loth e Sara Amabili Castilhos
**Projeto:** Projeto Integrador 2026/2 — Curso Técnico em Informática
**Versão:** 1.12 — 29/10/2026

---

## 1. Introdução

### 1.1 Propósito

Este documento especifica os requisitos do sistema de pesquisa de satisfação da FHDOD. Ele é a referência para o desenvolvimento, os testes e a validação com o cliente, e se destina à dupla, aos professores do Projeto Integrador e à Ouvidoria do hospital.

### 1.2 Escopo

O sistema é uma aplicação web responsiva com quatro partes: pesquisa do paciente, módulo da Ouvidoria, dashboard de gestão e TV Wall. Seus objetivos são aumentar a taxa de resposta (hoje cerca de 0,6%), registrar setor, data e turno em 100% das respostas e eliminar a transcrição manual de formulários.

### 1.3 Definições

| Termo | Significado |
| --- | --- |
| Setor | Unidade de atendimento com pesquisa própria (ex.: Pronto Atendimento, Internação, Raio-X) |
| Etapa da jornada | Ponto de contato do paciente dentro de um setor, cadastrado pelo Super Admin para cada setor (ex.: Recepção, Triagem, Enfermagem e Médico) |
| Turno | Período de trabalho com horário de início e fim (ex.: manhã, tarde, noite) |
| Escala | Relação mensal entre setor, data, turno e equipe |
| Equipe | Grupo de profissionais escalados em um setor e turno |
| Manifestação | Elogio, reclamação ou sugestão do paciente |
| Sessão | Uma abertura da pesquisa; agrupa as respostas de um mesmo paciente |
| Taxa de adesão | Respostas completas (com nota geral) dividido pelo número de atendimentos do período, informado pelo Super Admin (RF25) |
| NPS | Net Promoter Score, indicador calculado a partir da nota de 0 a 10 |
| Índice de satisfação | Porcentagem de avaliações positivas sobre as avaliações dadas: notas de 7 a 10 e rostinhos 4 e 5 ("Satisfeito" e "Muito satisfeito"). Perguntas puladas não contam |
| TV Wall | Tela de indicadores do hospital exibida em áreas de espera, sempre em porcentagem |
| LGPD | Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018) |

### 1.4 Referências

- IEEE Std 830-1998 — Recommended Practice for Software Requirements Specifications
- ISO/IEC 25010 — modelo de qualidade de produto de software
- Lei nº 13.709/2018 (LGPD)
- WCAG 2.1 — diretrizes de acessibilidade para conteúdo web
- Enunciados do Projeto Integrador 2026/2 e anotações do briefing com a Ouvidoria da FHDOD

### 1.5 Prioridade dos requisitos

- **Essencial:** obrigatório para a entrega; sem ele, o sistema não atende ao cliente.
- **Importante:** deve ser entregue, mas pode ser simplificado se o prazo exigir.
- **Desejável:** entra se houver tempo; caso contrário, passa para uma versão futura.

---

## 2. Contexto do Sistema

O sistema é uma plataforma web de pesquisa de satisfação para a Fundação Hospitalar Dr. Oswaldo Diesel (FHDOD), que substitui o formulário em papel usado pela Ouvidoria.

O problema que o sistema resolve é a baixa adesão e a baixa qualidade das respostas: cerca de 3 respostas a cada 500 atendimentos, formulários sem data, setor ou turno, elogios que se perdem e horas gastas transcrevendo papel para planilhas.

O sistema oferece:

- Pesquisa por setor, com URL e QR Code próprios, respondida só com toques, pensada para o celular do paciente e também usada em tablets de 10 polegadas nos setores.
- Perguntas de rostinho organizadas pelas etapas de cada setor (por exemplo, Recepção, Triagem, Enfermagem e Médico), cadastradas pela Ouvidoria; o paciente pula, com um toque, o que não viveu.
- Espaço para elogio, reclamação ou sugestão, anônimo ou com telefone para retorno.
- Módulo único da Ouvidoria, que reúne as manifestações da pesquisa e de outros canais e acompanha cada retorno até o encerramento.
- Dashboard de gestão atualizado automaticamente, do hospital até setor, turno e equipe, com exportação em Excel.
- TV Wall com a satisfação do hospital em porcentagem e, quando a Ouvidoria escolher, a de setores e etapas, para telas nas áreas de espera.

### 2.1 Perfis de acesso

| Perfil | Quem usa | O que acessa |
| --- | --- | --- |
| Paciente / acompanhante | Qualquer pessoa atendida, sem login | Pesquisa e manifestação |
| Super Admin | Ouvidoria | Tudo: configurações, setores, turnos, etapas, escala, usuários, todas as perguntas, dashboard completo, módulo da Ouvidoria e telefones |
| Gestor | Responsável por uma ou mais áreas | Perguntas e dashboard dos setores atribuídos a ele |

O hospital definiu no briefing dois níveis de administração. As funções de Ouvidoria, Gestão e Visualizador citadas no enunciado de Design estão contidas nesses dois perfis: a Ouvidoria é o Super Admin, e a gestão e a consulta de cada área ficam com o Gestor.

### 2.2 Dashboard e TV Wall

| | Dashboard | TV Wall |
| --- | --- | --- |
| Para quem | Super Admin e Gestor, com login | Pacientes, acompanhantes e funcionários, sem login |
| Objetivo | Descobrir onde melhorar e agir | Mostrar que a opinião do paciente importa e convidar a responder |
| Detalhe | Hospital, setor, turno, equipe e etapa | O hospital; setores e etapas só quando o Super Admin os marca |
| Conteúdo | Indicadores, rankings, notas baixas, manifestações, tendências | Índice de satisfação geral, taxa de adesão, evolução mensal, satisfação dos setores e etapas marcados e QR Code, sempre em porcentagem |
| Interação | Filtros, navegação e exportação | Nenhuma: painéis alternam sozinhos |

### 2.3 Restrições e premissas

**Restrições**

- Infraestrutura em planos gratuitos de nuvem, sem custo para o hospital.
- Conformidade com a LGPD no tratamento do telefone e dos textos dos pacientes.
- Sem integração com o prontuário ou outros sistemas do hospital nesta versão.
- Contato com o paciente após a alta (SMS, WhatsApp, aplicativo nativo) fica fora do escopo deste projeto; é tratado por outra frente do hospital/orientador.
- Prazo do Projeto Integrador 2026/2.

**Premissas**

- O hospital fornece a lista de setores, os horários dos turnos, as equipes de cada setor, a escala mensal e o número mensal de atendimentos por setor.
- Os tablets de 10 polegadas dos setores e a rede do hospital têm acesso estável à internet.
- A Ouvidoria define o texto dos termos de privacidade e as perguntas de cada setor.

---

## 3. Requisitos Funcionais (RF)

Os requisitos funcionais descrevem as ações e serviços que o sistema deve executar. A prioridade segue a convenção da seção 1.5.

### 3.1 Pesquisa do paciente

| ID | Requisito Funcional | Detalhamento / Critério de aceitação | Prioridade |
| --- | --- | --- | --- |
| **RF01** | O sistema deve disponibilizar uma pesquisa por setor, com URL e QR Code próprios. | Ex.: `/pesquisa/pronto-atendimento`. O QR Code pode ser baixado e impresso. | Essencial |
| **RF02** | A pesquisa deve funcionar sem login e sem instalação de aplicativo. | Setor (pela URL), data, hora e canal (celular ou tablet) são registrados automaticamente. | Essencial |
| **RF03** | A pesquisa deve ter uma única pergunta obrigatória: a nota de recomendação do hospital, de 0 a 10, exibida ao final. | O texto é "O quanto você recomendaria o hospital a um amigo ou familiar?", e a resposta é a nota geral usada nos indicadores e no NPS. Ela é fixa: não é cadastrada nem desativada. As demais perguntas são opcionais, com botão discreto de pular em cada uma — é esse botão, repetido pergunta a pergunta, que leva o paciente rápido até a nota, sem um atalho único que pule tudo de uma vez sem mostrar nada. | Essencial |
| **RF04** | A pesquisa deve ser respondida só com toques, uma pergunta por tela. | Todas as perguntas cadastradas são do tipo rostinho (1 a 5); só a nota final vai de 0 a 10 (RF03). Botões grandes em toda a pesquisa. A primeira tela avisa que a pesquisa leva menos de 1 minuto. Texto livre só no campo de manifestação. | Essencial |
| **RF05** | A pesquisa não deve indicar quantas perguntas faltam. | Sem contador, número de perguntas ou barra de progresso. A única referência é o nome da etapa atual (ex.: "Recepção"). | Importante |
| **RF06** | A pesquisa deve percorrer as etapas do setor, na ordem, sem pedir ao paciente que escolha por quais passou. | As etapas são de cada setor e cadastradas pelo Super Admin (RF20). A pesquisa só mostra as etapas ativas do setor que tenham pelo menos uma pergunta ativa, e o paciente pula, com um toque cada, as perguntas do que não viveu (RF03, RNF05). | Essencial |
| **RF07** | O sistema deve gravar cada resposta assim que o paciente avança de pergunta. | As respostas são acumulativas: cada uma entra nos indicadores no momento em que é gravada, mesmo que o paciente não conclua a pesquisa. | Essencial |
| **RF08** | O sistema deve adaptar o final da pesquisa conforme a nota geral. | Nota de 0 a 6 abre o espaço da Ouvidoria. Nota de 7 a 10 pergunta "Alguém da equipe fez diferença no seu atendimento?" e convida a deixar um elogio. | Essencial |
| **RF09** | O sistema deve oferecer espaço para elogio, reclamação ou sugestão. | O paciente escreve a mensagem sem classificá-la e sem campos de etapa ou de profissional: se quiser citar alguém, cita no próprio texto. O tipo (elogio, reclamação ou sugestão) é definido pela Ouvidoria (RN12). | Essencial |
| **RF10** | Qualquer paciente deve poder ficar anônimo ou deixar telefone para retorno. | Ao pedir retorno, aparecem o campo de telefone e a caixa de autorização (consentimento LGPD, com link para os termos). A tela tem um único botão, "Enviar". Com o telefone preenchido, "Enviar" só funciona com a caixa marcada; sem ela, a tela avisa que falta a autorização, nada é enviado e a tela não muda. Para enviar sem telefone, o paciente apaga o número ou desmarca o pedido de retorno, e a manifestação vai anônima. Com a mensagem e o telefone vazios, "Enviar" pergunta se a pessoa quer encerrar sem mensagem: "Voltar" mantém a tela, e "Encerrar sem mensagem" segue para o agradecimento sem enviar nada. | Essencial |
| **RF11** | Ao final, o sistema deve mostrar uma tela de agradecimento. | No tablet, a tela de agradecimento volta sozinha para o início 8 segundos depois de concluída a pesquisa, liberando o aparelho para o próximo paciente. No celular, a tela fica parada. | Importante |
| **RF12** | O sistema deve permitir responder depois, em casa. | O QR Code do setor aparece em cartazes, no documento de alta e no TV Wall. | Importante |
| **RF13** | O sistema deve evitar respostas duplicadas e tratar sessões abandonadas no tablet. | Cada pesquisa aberta gera uma sessão, e cada pergunta é gravada uma única vez por sessão. No celular, quem já respondeu ao setor nas últimas 12 horas vê "Você já respondeu hoje" e pode complementar. No tablet, se ficar 2 minutos sem toque com uma pesquisa em aberto, aparece a tela "Continuar pesquisa" ou "Nova pesquisa": a primeira retoma de onde o paciente parou, a segunda descarta a sessão aberta e começa em branco para o próximo paciente. | Importante |

### 3.2 Ouvidoria (Super Admin)

| ID | Requisito Funcional | Detalhamento / Critério de aceitação | Prioridade |
| --- | --- | --- | --- |
| **RF14** | O Super Admin deve ver a lista de manifestações com filtros. | Mostra protocolo, tipo (ou "a classificar"), setor, data, turno, nota, status, se o paciente pediu retorno e o número de tentativas de contato. O texto do relato e o telefone aparecem só no detalhe do chamado, para a lista ficar legível e o telefone mais protegido. Filtros por protocolo, status, tipo (inclusive "a classificar"), setor, período e turno. | Essencial |
| **RF15** | O Super Admin deve tratar cada manifestação como um chamado. | Registra cada tentativa de contato (data, responsável, resultado). Status: Nova (vermelho), Em contato (amarelo), Encerrada (verde) e Sem retorno (cinza, após 3 tentativas sem sucesso). "Encerrada" e "Sem retorno" finalizam o chamado e exigem o desfecho descrito. O Super Admin define o tipo de cada manifestação vinda da pesquisa e pode corrigi-lo, com registro no log (RNF11); só um chamado com tipo definido pode ser finalizado (RN12). | Essencial |
| **RF16** | O sistema deve alertar sobre pedidos de retorno sem primeiro contato em 48 horas úteis. | O alerta aparece no topo do módulo da Ouvidoria. Contam-se as horas de segunda a sexta-feira; feriados não são descontados nesta versão. | Importante |
| **RF17** | O Super Admin deve registrar manifestações recebidas por outros canais. | Telefone, presencial, e-mail ou papel seguem o mesmo fluxo da pesquisa. O Super Admin pode anotar a etapa (do setor da manifestação) e o profissional citado. Para papel, o Super Admin pode anexar uma foto do formulário ao registro; a digitação dos dados continua manual (ver RN11 sobre o motivo de não haver leitura automática). | Importante |
| **RF18** | **Removido na versão 1.12.** | Previa aprovar elogios para o TV Wall e cadastrar melhorias para o painel "Sua resposta virou melhoria". Por orientação do professor orientador, o TV Wall deixou de mostrar elogios e melhorias, e o sistema deixou de guardá-los. O identificador não é reaproveitado. | — |
| **RF19** | O sistema deve marcar manifestações com o mesmo telefone e setor em 24 horas como possível duplicata. | A comparação usa o hash HMAC do telefone (RNF10), já que o número fica criptografado. A marca é só um aviso; a manifestação não é bloqueada. | Desejável |

### 3.3 Administração

| ID | Requisito Funcional | Detalhamento / Critério de aceitação | Prioridade |
| --- | --- | --- | --- |
| **RF20** | O Super Admin deve gerenciar setores, turnos, etapas da jornada, equipes e gestores. | Cria, edita e desativa; nada é apagado. Nomes não se repetem, sem diferenciar maiúsculas nem acentos (RN13). Cada etapa e cada equipe pertencem a um setor, e as etapas de um setor podem ser reordenadas. Cada gestor recebe um ou mais setores, e um setor pode ter mais de um gestor (RN10). Pode haver mais de um Super Admin. | Essencial |
| **RF21** | O Super Admin deve importar a escala mensal por planilha Excel. | Cada linha: setor + data + turno + equipe. A importação só aceita equipes cadastradas e ativas no setor da linha, reconhecendo setor, turno e equipe sem diferenciar maiúsculas nem acentos (RN13); se alguma linha tiver erro, nada é gravado e o sistema indica as linhas a corrigir. | Essencial |
| **RF22** | O Super Admin deve gerenciar todas as perguntas; o Gestor, as perguntas dos seus setores. | Cadastrar, editar, ordenar e ativar/desativar. Pergunta não pode ser criada nem reativada em etapa desativada. Toda pergunta é um rostinho (1 a 5) de uma etapa do setor. A nota de 0 a 10 (RF03) e a tela de data e período do atendimento (RN03) são fixas e não são cadastradas. | Essencial |
| **RF23** | As perguntas não podem ser removidas, apenas desativadas. | Pergunta desativada sai da pesquisa, mas suas respostas continuam nos relatórios. | Essencial |
| **RF24** | O Super Admin deve definir o texto dos termos de privacidade. | Os termos ficam em link na pesquisa. | Importante |
| **RF25** | O Super Admin deve informar o número mensal de atendimentos por setor. | Usado para calcular a taxa de adesão (RF27): respostas completas ÷ atendimentos informados, por setor e por período. | Desejável |
| **RF26** | O sistema deve exigir login (e-mail e senha) para Super Admin e Gestor. | Pesquisa e TV Wall são públicos. | Essencial |

### 3.4 Indicadores

| ID | Requisito Funcional | Detalhamento / Critério de aceitação | Prioridade |
| --- | --- | --- | --- |
| **RF27** | O sistema deve exibir um dashboard com os indicadores atualizados automaticamente. | Total de respostas, taxa de adesão (respostas completas ÷ atendimentos informados no RF25), nota média, NPS, índice de satisfação geral, por setor e por etapa, distribuição das notas, comparação com o período anterior e manifestações por tipo, com as ainda não classificadas em uma categoria própria ("a classificar"). A atualização segue o RNF07. A taxa de adesão só é calculada para setores e períodos com atendimentos informados; nos demais, o painel indica "atendimentos não informados". | Essencial |
| **RF28** | O dashboard deve permitir navegar do hospital até setor, turno e equipe. | Filtros por período, setor, turno, etapa (dentro do setor escolhido) e canal; ranking de setores e etapas pelo índice de satisfação. O Gestor vê só seus setores. Nomes citados em manifestações não aparecem. | Essencial |
| **RF29** | O sistema deve exportar os dados em Excel e gerar relatório mensal. | A exportação respeita os filtros aplicados. O relatório mensal é gerado em PDF. | Essencial |
| **RF30** | O sistema deve ter um TV Wall com a visão geral do hospital. | Tela cheia, tema claro seguindo a identidade visual da FHDOD (RNF06), atualização automática (RNF07) e painéis alternando a cada 15 segundos, todos em porcentagem (RN08): índice de satisfação geral e taxa de adesão do mês, evolução do índice nos últimos 6 meses, satisfação por setor, satisfação por etapa e QR Code. O painel geral aparece sempre; os de setor e de etapa mostram só os que o Super Admin marcar (RF31) e que tenham o mínimo de avaliações no mês. O QR Code leva à pesquisa do setor atendido pela área de espera onde a TV está; cada TV abre o TV Wall com o setor no endereço (ex.: `/tv-wall/pronto-atendimento`), e sem setor no endereço o painel do QR Code não entra no rodízio. O setor do endereço só define o QR Code: os painéis são os mesmos em todas as TVs. | Essencial |
| **RF31** | O Super Admin deve escolher quais setores e quais etapas aparecem no TV Wall. | Cada setor e cada etapa é marcado um a um; nenhum aparece por padrão. Um setor ou etapa marcado só entra no painel com pelo menos 10 avaliações no mês, para a porcentagem não expor uma amostra pequena (RN08). | Importante |

---

## 4. Requisitos Não Funcionais (RNF)

Requisitos não funcionais definem atributos de qualidade, classificados conforme a ISO/IEC 25010.

| ID | Requisito Não Funcional | Categoria (ISO/IEC 25010) |
| --- | --- | --- |
| RNF01 | O sistema deve usar React (Vite) no frontend, Node.js com Express no backend, Prisma como ORM e PostgreSQL como banco de dados. | Restrição tecnológica |
| RNF02 | O sistema deve ser publicado em nuvem: frontend na Vercel, backend no Render e banco no Neon, com backup automático do banco. | Confiabilidade |
| RNF03 | A pesquisa deve ser projetada primeiro para celular (telas de 360 a 430 px de largura), canal principal de resposta, e adaptada ao tablet de 10 polegadas dos setores (800 × 1280 px, em pé). O dashboard é otimizado para computador (1366 px) e o TV Wall para TV Full HD (1920 × 1080 px). | Compatibilidade |
| RNF04 | A pesquisa deve ser acessível: botões de no mínimo 48 × 48 px, contraste mínimo de 4,5:1 (WCAG AA), fonte de no mínimo 18 px, rostinhos sempre com rótulo em texto e som de confirmação ao toque, que o paciente pode ativar na primeira tela. | Usabilidade — acessibilidade |
| RNF05 | O paciente deve conseguir pular qualquer pergunta opcional em 1 toque, e concluir a pesquisa inteira — respondendo ou pulando cada pergunta — em até 1 minuto. | Usabilidade — operabilidade |
| RNF06 | A interface — pesquisa, dashboard e TV Wall — deve seguir a identidade visual da FHDOD: vermelho do logo como cor principal e fundo branco. Textos pequenos usam um vermelho mais escuro para atingir o contraste do RNF04, e a escala de rostinhos usa cores que não se confundem com a marca. O tema claro único evita manter duas paletas e mantém a marca reconhecível também de longe, no TV Wall. | Usabilidade — estética |
| RNF07 | A pesquisa deve carregar em menos de 3 segundos, e uma nova resposta deve aparecer no dashboard e no TV Wall em até 5 segundos. O dashboard e o TV Wall buscam dados novos a cada 5 segundos (polling HTTP), em vez de manter conexão aberta — mais simples de manter e resistente a quedas do plano gratuito. Exceção: no plano gratuito do Render, o primeiro acesso após 15 minutos sem uso pode levar até 1 minuto. Não há modo offline nem cache local de respostas, pois a internet do hospital é estável e cada resposta é gravada direto no servidor. | Eficiência de desempenho |
| RNF08 | As rotas da API usadas pela pesquisa e pelo TV Wall são públicas e não usam token. Elas são protegidas por validação dos dados, pelo código de sessão (uma resposta por pergunta) e por um limite alto por IP (60 envios por minuto), já que os aparelhos no Wi-Fi do hospital compartilham o mesmo IP. As rotas de gestão exigem token JWT com expiração. | Segurança — autenticidade |
| RNF09 | O backend deve validar todas as entradas, usar consultas parametrizadas (Prisma) contra SQL injection e sanitizar textos contra XSS. Senhas são armazenadas com bcrypt, e todo o tráfego usa HTTPS. | Segurança — integridade |
| RNF10 | O Gestor acessa apenas os setores atribuídos a ele. O telefone do paciente é visível só para o Super Admin e fica criptografado no banco, com um hash HMAC-SHA256 separado, gerado com uma chave secreta guardada fora do banco e usado apenas para comparação. | Segurança — confidencialidade |
| RNF11 | Alterações em manifestações, perguntas e usuários ficam registradas em log, com usuário, ação e data. | Segurança — responsabilização |
| RNF12 | O sistema segue a LGPD: coleta o mínimo de dados pessoais, só guarda telefone com consentimento e apaga o telefone e o seu hash quando o chamado é finalizado. | Conformidade legal |
| RNF13 | O backend é organizado em camadas (rotas, controllers, services, repositories), com a API documentada em Swagger (OpenAPI) e testes automatizados com Jest e Supertest, cobrindo no mínimo 60% da camada de serviços. | Manutenibilidade |

---

## 5. Regras de Negócio (RN)

Regras de negócio são condições que restringem ou orientam a execução das funcionalidades.

| ID | Regra de Negócio | Descrição |
| --- | --- | --- |
| RN01 | Respostas acumulativas | Nenhuma resposta é sobrescrita ou apagada. Respostas de pesquisas não concluídas entram nos indicadores das etapas, e só entram na nota geral as que têm a nota de 0 a 10. |
| RN02 | Setor definido pela URL | O paciente não escolhe o setor: ele vem do link ou QR Code usado. |
| RN03 | Data e turno do atendimento | No celular, uma tela fixa (não cadastrada) pergunta a data e o período do atendimento, e valem a data e o turno informados; quem pula fica com a data e o turno calculados pela hora da resposta. No tablet, que fica no setor, a tela não aparece, e o cálculo pela hora vale sempre. |
| RN04 | Avaliação da equipe, não do profissional | As notas são ligadas à equipe do turno pela escala. Profissionais citados ficam só na manifestação, tratada pela Ouvidoria, e não aparecem em indicadores. |
| RN05 | Encaminhamento à Ouvidoria | Nota geral de 0 a 6 abre o espaço da Ouvidoria; manifestação com telefone entra na fila com status "Nova". |
| RN06 | Telefone só com consentimento | O telefone só é gravado com o aceite dos termos e nunca é gravado sem ele. Uma manifestação com telefone e sem aceite não é enviada: a tela pede a autorização (RF10) e a API a recusa. Para ficar anônimo, o paciente envia sem telefone. |
| RN07 | Finalização do chamado | Um chamado só é finalizado ("Encerrada" ou "Sem retorno") com o desfecho descrito, e a manifestação nunca é apagada. Ao finalizar, o telefone e o seu hash são apagados e ela passa a ser anônima. |
| RN08 | TV Wall só com porcentagens | O TV Wall mostra só porcentagens, nunca contagens, para não expor quantas pessoas responderam. Setores e etapas aparecem só quando marcados pelo Super Admin (RF31) e com pelo menos 10 avaliações no mês. O TV Wall nunca mostra turno, equipe, manifestações, nomes ou telefones. |
| RN09 | Perguntas nunca são removidas | Perguntas só são desativadas, para manter a rastreabilidade das respostas. |
| RN10 | Gestor por área | Um Gestor pode ser responsável por mais de um setor, e um setor pode ter mais de um Gestor. |
| RN11 | Papel digitado manualmente | Formulários em papel são fotografados para anexo (RF17), mas os dados são digitados por uma pessoa. Como as marcações do papel são por bolinhas (não texto escrito à mão), leitura automática por reconhecimento óptico de marcação (OMR) é tecnicamente viável, mas exige gabarito impresso fixo e processamento de imagem à parte. Como o papel virou canal secundário — a maior parte das respostas já chega digital pelo RF02 — essa automação fica como perspectiva futura, fora do escopo desta versão. |
| RN12 | Tipo definido pela Ouvidoria | O paciente não classifica a própria manifestação, porque poderia escolher o tipo pelo sentimento e não pelo conteúdo, distorcendo os indicadores. A manifestação da pesquisa chega "a classificar", e o Super Admin define o tipo ao tratá-la. Nos outros canais (RF17), o tipo é definido já no registro. |
| RN13 | Nomes sem repetição disfarçada | Nomes de setores, turnos, etapas e equipes (estas, dentro do mesmo setor) não se repetem mesmo que mudem só em maiúsculas ou acentos: "Recepção" e "RECEPCAO" são o mesmo nome. O nome fica gravado como foi digitado, e a busca por nome, como a da importação da escala, encontra o cadastro de qualquer forma que ele seja escrito. Espaços e pontuação continuam diferenciando ("Raio-X" e "Raio X" são nomes diferentes). |

---

## 6. Rastreabilidade do Briefing

| Necessidade do cliente | Requisitos |
| --- | --- |
| Aumentar a adesão às respostas | RF02–RF06, RF08, RF12, RF30, RNF05 |
| Saber setor, data e turno de cada resposta | RF01, RF02, RN02, RN03 |
| Identificar a equipe sem culpar um profissional | RF20, RF21, RF28, RN04 |
| Responder pelo celular e pelo tablet do setor | RF01, RF12, RNF03 |
| Não perguntar o que o paciente não viveu | RF03, RF06, RF22 |
| Não perder respostas de quem desiste no meio | RF07, RN01 |
| Resgatar os elogios | RF08, RF09, RN12 |
| Saber se o paciente quer retorno e acompanhar o contato | RF10, RF14–RF16, RN06, RN07 |
| Unificar a Ouvidoria | RF14, RF17, RN12 |
| Acabar com a transcrição do papel e ter métricas em número | RF25, RF27–RF29 |
| Cada área cadastrar as próprias perguntas | RF20, RF22, RN10 |
| Rastreabilidade das perguntas e respostas | RF23, RN01, RN09, RNF11 |
| Indicadores visíveis em tela | RF30, RF31, RN08 |
| Acessibilidade e facilidade de uso | RF04, RF05, RNF04, RNF05 |
| Proteger os dados do paciente (LGPD) | RF10, RNF10, RNF12, RN06, RN07 |
| Evitar duplicatas | RF13, RF19, RN13 |

---

## 7. Considerações Finais

Este documento define o escopo funcional e as restrições do sistema desenvolvido no Projeto Integrador 2026/2. As funcionalidades descritas são as que se pretende implementar, considerando o prazo e os recursos disponíveis.
