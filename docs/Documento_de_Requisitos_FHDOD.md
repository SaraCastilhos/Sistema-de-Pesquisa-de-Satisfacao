# Documento de Requisitos do Sistema — Pesquisa de Satisfação FHDOD

**Cliente:** Fundação Hospitalar Dr. Oswaldo Diesel (FHDOD), Três Coroas/RS — Ouvidoria
**Responsáveis:** Maria Luiza Altenhofen Loth e Sara Amabili Castilhos
**Projeto:** Projeto Integrador 2026/2 — Curso Técnico em Informática
**Versão:** 1.6 — 12/10/2026

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
| Etapa da jornada | Ponto de contato do paciente: Recepção, Triagem, Enfermagem ou Médico |
| Turno | Período de trabalho com horário de início e fim (ex.: manhã, tarde, noite) |
| Escala | Relação mensal entre setor, data, turno e equipe |
| Equipe | Grupo de profissionais escalados em um setor e turno |
| Manifestação | Elogio, reclamação ou sugestão do paciente |
| Sessão | Uma abertura da pesquisa; agrupa as respostas de um mesmo paciente |
| Taxa de adesão | Respostas completas (com nota geral) dividido pelo número de atendimentos do período, informado pelo Super Admin (RF25) |
| NPS | Net Promoter Score, indicador calculado a partir da nota de 0 a 10 |
| TV Wall | Tela de indicadores gerais do hospital exibida em áreas de espera |
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
- Perguntas organizadas pela jornada do paciente (Recepção, Triagem, Enfermagem, Médico), exibidas apenas para as etapas que ele viveu.
- Espaço para elogio, reclamação ou sugestão, anônimo ou com telefone para retorno.
- Módulo único da Ouvidoria, que reúne as manifestações da pesquisa e de outros canais e acompanha cada retorno até o encerramento.
- Dashboard de gestão em tempo real, do hospital até setor, turno e equipe, com exportação em Excel.
- TV Wall com a visão geral do hospital, para telas nas áreas de espera.

### 2.1 Perfis de acesso

| Perfil | Quem usa | O que acessa |
| --- | --- | --- |
| Paciente / acompanhante | Qualquer pessoa atendida, sem login | Pesquisa e manifestação |
| Super Admin | Ouvidoria | Tudo: configurações, setores, turnos, escala, usuários, todas as perguntas, dashboard completo, módulo da Ouvidoria e telefones |
| Gestor | Responsável por uma ou mais áreas | Perguntas e dashboard dos setores atribuídos a ele |

O hospital definiu no briefing dois níveis de administração. As funções de Ouvidoria, Gestão e Visualizador citadas no enunciado de Design estão contidas nesses dois perfis: a Ouvidoria é o Super Admin, e a gestão e a consulta de cada área ficam com o Gestor.

### 2.2 Dashboard e TV Wall

| | Dashboard | TV Wall |
| --- | --- | --- |
| Para quem | Super Admin e Gestor, com login | Pacientes, acompanhantes e funcionários, sem login |
| Objetivo | Descobrir onde melhorar e agir | Mostrar que a opinião do paciente importa e convidar a responder |
| Detalhe | Hospital, setor, turno, equipe e etapa | Só o hospital como um todo |
| Conteúdo | Indicadores, rankings, notas baixas, manifestações, tendências | Nota geral, total de respostas, evolução mensal, elogios aprovados, melhorias feitas e QR Code |
| Interação | Filtros, navegação e exportação | Nenhuma: painéis alternam sozinhos |

### 2.3 Restrições e premissas

**Restrições**

- Infraestrutura em planos gratuitos de nuvem, sem custo para o hospital.
- Conformidade com a LGPD no tratamento do telefone e dos textos dos pacientes.
- Sem integração com o prontuário ou outros sistemas do hospital nesta versão.
- Contato com o paciente após a alta (SMS, WhatsApp, aplicativo nativo) fica fora do escopo deste projeto; é tratado por outra frente do hospital/orientador.
- Prazo do Projeto Integrador 2026/2.

**Premissas**

- O hospital fornece a lista de setores, os horários dos turnos, a escala mensal e o número mensal de atendimentos por setor.
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
| **RF03** | A pesquisa deve ter uma única pergunta obrigatória: a nota geral do hospital, de 0 a 10, exibida ao final. | As demais perguntas são opcionais, com botão discreto de pular. Toda tela tem também um link discreto "Ir direto para a nota". | Essencial |
| **RF04** | A pesquisa deve ser respondida só com toques, uma pergunta por tela. | A primeira pergunta de cada etapa é do tipo rostinho (1 a 5), para abrir a pesquisa de forma leve; as demais podem usar qualquer tipo cadastrado (RF22). Botões grandes em toda a pesquisa. A primeira tela avisa que a pesquisa leva menos de 1 minuto. Texto livre só no campo de manifestação. | Essencial |
| **RF05** | A pesquisa não deve indicar quantas perguntas faltam. | Sem contador, número de perguntas ou barra de progresso. A única referência é o nome da etapa atual (ex.: "Recepção"). | Importante |
| **RF06** | O sistema deve perguntar por quais etapas o paciente passou e exibir só as perguntas dessas etapas. | Etapas: Recepção, Triagem, Enfermagem, Médico. | Essencial |
| **RF07** | O sistema deve gravar cada resposta assim que o paciente avança de pergunta. | As respostas são acumulativas: cada uma entra nos indicadores no momento em que é gravada, mesmo que o paciente não conclua a pesquisa. | Essencial |
| **RF08** | O sistema deve adaptar o final da pesquisa conforme a nota geral. | Nota de 0 a 6 abre o espaço da Ouvidoria. Nota de 7 a 10 pergunta "Alguém da equipe fez diferença no seu atendimento?" e convida a deixar um elogio. | Essencial |
| **RF09** | O sistema deve oferecer espaço para elogio, reclamação ou sugestão. | O tipo é escolhido por botão; o paciente pode indicar a etapa e citar o profissional envolvido. | Essencial |
| **RF10** | Qualquer paciente deve poder ficar anônimo ou deixar telefone para retorno. | Ao informar telefone, aparece o consentimento LGPD com link para os termos e os botões "Enviar" e "Cancelar". Tocar em "Cancelar" pergunta "Tem certeza que deseja cancelar o envio do telefone?"; confirmando, o telefone é descartado e a pesquisa segue para o agradecimento. | Essencial |
| **RF11** | Ao final, o sistema deve mostrar uma tela de agradecimento. | No tablet, a tela de agradecimento tem um botão "Nova pesquisa", para quem está passando o aparelho ao próximo paciente. Não há retorno automático por tempo: a tela só muda quando alguém toca o botão. | Importante |
| **RF12** | O sistema deve permitir responder depois, em casa. | O QR Code aparece no tablet, em cartazes, no documento de alta e no TV Wall. | Importante |
| **RF13** | O sistema deve evitar respostas duplicadas e tratar sessões abandonadas no tablet. | Cada pesquisa aberta gera uma sessão, e cada pergunta é gravada uma única vez por sessão. No celular, quem já respondeu ao setor nas últimas 12 horas vê "Você já respondeu hoje" e pode complementar. No tablet, se ficar 2 minutos sem toque com uma pesquisa em aberto, aparece a tela "Continuar pesquisa" ou "Nova pesquisa": a primeira retoma de onde o paciente parou, a segunda descarta a sessão aberta e começa em branco para o próximo paciente. | Importante |

### 3.2 Ouvidoria (Super Admin)

| ID | Requisito Funcional | Detalhamento / Critério de aceitação | Prioridade |
| --- | --- | --- | --- |
| **RF14** | O Super Admin deve ver a lista de manifestações com filtros. | Mostra tipo, setor, data, turno, nota, texto e telefone. Filtros por status, tipo, setor, período e turno. | Essencial |
| **RF15** | O Super Admin deve tratar cada manifestação como um chamado. | Registra cada tentativa de contato (data, responsável, resultado). Status: Nova (vermelho), Em contato (amarelo), Encerrada (verde) e Sem retorno (cinza, após 3 tentativas sem sucesso). "Encerrada" e "Sem retorno" finalizam o chamado e exigem o desfecho descrito. | Essencial |
| **RF16** | O sistema deve alertar sobre pedidos de retorno sem primeiro contato em 48 horas úteis. | O alerta aparece no topo do módulo da Ouvidoria. | Importante |
| **RF17** | O Super Admin deve registrar manifestações recebidas por outros canais. | Telefone, presencial, e-mail ou papel seguem o mesmo fluxo da pesquisa. Para papel, o Super Admin pode anexar uma foto do formulário ao registro; a digitação dos dados continua manual (ver RN11 sobre o motivo de não haver leitura automática). | Importante |
| **RF18** | O Super Admin deve aprovar elogios para o TV Wall e cadastrar melhorias feitas a partir das pesquisas. | Elogios aparecem sem nome do paciente. Melhorias alimentam o painel "Sua resposta virou melhoria". | Desejável |
| **RF19** | O sistema deve marcar manifestações com o mesmo telefone e setor em 24 horas como possível duplicata. | A comparação usa um hash do telefone, já que o número fica criptografado. A marca é só um aviso; a manifestação não é bloqueada. | Desejável |

### 3.3 Administração

| ID | Requisito Funcional | Detalhamento / Critério de aceitação | Prioridade |
| --- | --- | --- | --- |
| **RF20** | O Super Admin deve gerenciar setores, turnos e gestores. | Cria, edita e desativa. Cada gestor recebe um ou mais setores. | Essencial |
| **RF21** | O Super Admin deve importar a escala mensal por planilha Excel. | Cada linha: setor + data + turno + equipe. | Essencial |
| **RF22** | O Super Admin deve gerenciar todas as perguntas; o Gestor, as perguntas dos seus setores. | Cadastrar, editar, ordenar e ativar/desativar. Tipos: rostinhos (1 a 5), escala (0 a 10), sim/não, múltipla escolha e data e período do atendimento. | Essencial |
| **RF23** | As perguntas não podem ser removidas, apenas desativadas. | Pergunta desativada sai da pesquisa, mas suas respostas continuam nos relatórios. | Essencial |
| **RF24** | O Super Admin deve definir o texto dos termos de privacidade. | Os termos ficam em link na pesquisa. | Importante |
| **RF25** | O Super Admin deve informar o número mensal de atendimentos por setor. | Usado para calcular a taxa de adesão (RF27): respostas completas ÷ atendimentos informados, por setor e por período. | Desejável |
| **RF26** | O sistema deve exigir login (e-mail e senha) para Super Admin e Gestor. | Pesquisa e TV Wall são públicos. | Essencial |

### 3.4 Indicadores

| ID | Requisito Funcional | Detalhamento / Critério de aceitação | Prioridade |
| --- | --- | --- | --- |
| **RF27** | O sistema deve exibir um dashboard atualizado em tempo real. | Total de respostas, taxa de adesão (respostas completas ÷ atendimentos informados no RF25), nota média, NPS, distribuição das notas e manifestações por tipo. | Essencial |
| **RF28** | O dashboard deve permitir navegar do hospital até setor, turno e equipe. | Filtros por período, setor, turno, etapa e canal; ranking de setores e etapas. O Gestor vê só seus setores. Nomes citados em manifestações não aparecem. | Essencial |
| **RF29** | O sistema deve exportar os dados em Excel e gerar relatório mensal. | A exportação respeita os filtros aplicados. O relatório mensal é gerado em PDF. | Essencial |
| **RF30** | O sistema deve ter um TV Wall com a visão geral do hospital. | Tela cheia, tema claro seguindo a identidade visual da FHDOD (RNF06), atualização em tempo real e painéis alternando a cada 15 segundos: nota geral e total de respostas do mês, evolução da nota nos últimos 6 meses, elogios aprovados, "Sua resposta virou melhoria" e QR Code. | Essencial |

---

## 4. Requisitos Não Funcionais (RNF)

Requisitos não funcionais definem atributos de qualidade, classificados conforme a ISO/IEC 25010.

| ID | Requisito Não Funcional | Categoria (ISO/IEC 25010) |
| --- | --- | --- |
| RNF01 | O sistema deve usar React (Vite) no frontend, Node.js com Express no backend, Prisma como ORM, PostgreSQL como banco de dados e Socket.IO para atualização em tempo real. | Restrição tecnológica |
| RNF02 | O sistema deve ser publicado em nuvem: frontend na Vercel, backend no Render e banco no Neon, com backup automático do banco. | Confiabilidade |
| RNF03 | A pesquisa deve ser projetada primeiro para celular (telas de 360 a 430 px de largura), canal principal de resposta, e adaptada ao tablet de 10 polegadas dos setores (800 × 1280 px, em pé). O dashboard é otimizado para computador (1366 px) e o TV Wall para TV Full HD (1920 × 1080 px). | Compatibilidade |
| RNF04 | A pesquisa deve ser acessível: botões de no mínimo 48 × 48 px, contraste mínimo de 4,5:1 (WCAG AA), fonte de no mínimo 18 px, rostinhos sempre com rótulo em texto e som de confirmação ao toque, que o paciente pode ativar na primeira tela. | Usabilidade — acessibilidade |
| RNF05 | O paciente deve chegar à nota obrigatória e enviá-la em até 3 toques, usando "Ir direto para a nota", e concluir a pesquisa completa em até 1 minuto. | Usabilidade — operabilidade |
| RNF06 | A interface — pesquisa, dashboard e TV Wall — deve seguir a identidade visual da FHDOD: vermelho do logo como cor principal e fundo branco. Textos pequenos usam um vermelho mais escuro para atingir o contraste do RNF04, e a escala de rostinhos usa cores que não se confundem com a marca. O tema claro único evita manter duas paletas e mantém a marca reconhecível também de longe, no TV Wall. | Usabilidade — estética |
| RNF07 | A pesquisa deve carregar em menos de 3 segundos, e uma nova resposta deve aparecer no dashboard e no TV Wall em até 5 segundos. Exceção: no plano gratuito do Render, o primeiro acesso após 15 minutos sem uso pode levar até 1 minuto. Não há modo offline nem cache local de respostas, pois a internet do hospital é estável e cada resposta é gravada direto no servidor. | Eficiência de desempenho |
| RNF08 | As rotas da API usadas pela pesquisa e pelo TV Wall são públicas e não usam token. Elas são protegidas por validação dos dados, pelo código de sessão (uma resposta por pergunta) e por um limite alto por IP (60 envios por minuto), já que os aparelhos no Wi-Fi do hospital compartilham o mesmo IP. As rotas de gestão exigem token JWT com expiração. | Segurança — autenticidade |
| RNF09 | O backend deve validar todas as entradas, usar consultas parametrizadas (Prisma) contra SQL injection e sanitizar textos contra XSS. Senhas são armazenadas com bcrypt, e todo o tráfego usa HTTPS. | Segurança — integridade |
| RNF10 | O Gestor acessa apenas os setores atribuídos a ele. O telefone do paciente é visível só para o Super Admin e fica criptografado no banco, com um hash separado usado apenas para comparação. | Segurança — confidencialidade |
| RNF11 | Alterações em manifestações, perguntas e usuários ficam registradas em log, com usuário, ação e data. | Segurança — responsabilização |
| RNF12 | O sistema segue a LGPD: coleta o mínimo de dados pessoais, só guarda telefone com consentimento e o apaga quando o chamado é finalizado. | Conformidade legal |
| RNF13 | O backend é organizado em camadas (rotas, controllers, services, repositories), com a API documentada em Swagger (OpenAPI) e testes automatizados com Jest e Supertest, cobrindo no mínimo 60% da camada de serviços. | Manutenibilidade |

---

## 5. Regras de Negócio (RN)

Regras de negócio são condições que restringem ou orientam a execução das funcionalidades.

| ID | Regra de Negócio | Descrição |
| --- | --- | --- |
| RN01 | Respostas acumulativas | Nenhuma resposta é sobrescrita ou apagada. Respostas de pesquisas não concluídas entram nos indicadores das etapas, e só entram na nota geral as que têm a nota de 0 a 10. |
| RN02 | Setor definido pela URL | O paciente não escolhe o setor: ele vem do link ou QR Code usado. |
| RN03 | Data e turno do atendimento | A pergunta de data e período do atendimento vem ativa por padrão, e o turno é o que o paciente informar. Se o Super Admin desativá-la, o turno passa a ser calculado pela hora da resposta. |
| RN04 | Avaliação da equipe, não do profissional | As notas são ligadas à equipe do turno pela escala. Profissionais citados ficam só na manifestação, tratada pela Ouvidoria, e não aparecem em indicadores. |
| RN05 | Encaminhamento à Ouvidoria | Nota geral de 0 a 6 abre o espaço da Ouvidoria; manifestação com telefone entra na fila com status "Nova". |
| RN06 | Telefone só com consentimento | Sem o aceite dos termos, a manifestação é registrada como anônima. |
| RN07 | Finalização do chamado | Um chamado só é finalizado ("Encerrada" ou "Sem retorno") com o desfecho descrito, e a manifestação nunca é apagada. Ao finalizar, o telefone é apagado e ela passa a ser anônima. |
| RN08 | TV Wall só com dados gerais | O TV Wall nunca mostra setor, turno, equipe, reclamações, nomes, telefones ou texto não aprovado pelo Super Admin. |
| RN09 | Perguntas nunca são removidas | Perguntas só são desativadas, para manter a rastreabilidade das respostas. |
| RN10 | Gestor por área | Um Gestor pode ser responsável por mais de um setor, e um setor pode ter mais de um Gestor. |
| RN11 | Papel digitado manualmente | Formulários em papel são fotografados para anexo (RF17), mas os dados são digitados por uma pessoa. Como as marcações do papel são por bolinhas (não texto escrito à mão), leitura automática por reconhecimento óptico de marcação (OMR) é tecnicamente viável, mas exige gabarito impresso fixo e processamento de imagem à parte. Como o papel virou canal secundário — a maior parte das respostas já chega digital pelo RF02 — essa automação fica como perspectiva futura, fora do escopo desta versão. |

---

## 6. Rastreabilidade do Briefing

| Necessidade do cliente | Requisitos |
| --- | --- |
| Aumentar a adesão às respostas | RF02–RF06, RF08, RF12, RF30, RNF05 |
| Saber setor, data e turno de cada resposta | RF01, RF02, RN02, RN03 |
| Identificar a equipe sem culpar um profissional | RF21, RF28, RN04 |
| Responder pelo celular e pelo tablet do setor | RF01, RF12, RNF03 |
| Não perguntar o que o paciente não viveu | RF06, RF22 |
| Não perder respostas de quem desiste no meio | RF07, RN01 |
| Resgatar os elogios | RF08, RF09, RF18, RF30 |
| Saber se o paciente quer retorno e acompanhar o contato | RF10, RF14–RF16, RN06, RN07 |
| Unificar a Ouvidoria | RF14, RF17 |
| Acabar com a transcrição do papel e ter métricas em número | RF25, RF27–RF29 |
| Cada área cadastrar as próprias perguntas | RF20, RF22, RN10 |
| Rastreabilidade das perguntas e respostas | RF23, RN01, RN09, RNF11 |
| Indicadores visíveis em tela | RF30, RN08 |
| Acessibilidade e facilidade de uso | RF04, RF05, RNF04, RNF05 |
| Proteger os dados do paciente (LGPD) | RF10, RNF10, RNF12, RN06, RN07 |
| Evitar duplicatas | RF13, RF19 |

---

## 7. Considerações Finais

Este documento define o escopo funcional e as restrições do sistema desenvolvido no Projeto Integrador 2026/2. As funcionalidades descritas são as que se pretende implementar, considerando o prazo e os recursos disponíveis.
