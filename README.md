# Ponto Certo

Desenvolva uma aplicação web chamada “Portal do Supervisor”, em português do Brasil, para uma empresa de serviços terceirizados de limpeza.

O sistema deve controlar presença dos funcionários, conferir cartões de ponto em PDF, gerenciar cobertura de faltas por diaristas, conferir o efetivo por contrato e calcular descontos previstos no faturamento.

Quero uma aplicação funcional, com banco de dados, autenticação, permissões e dados persistentes. Não entregue apenas telas com números estáticos.

Utilize Supabase para autenticação, banco de dados e armazenamento dos documentos, se disponível neste projeto. Caso alguma integração exija configuração externa, indique isso claramente e mantenha o restante do sistema funcional.

INTERFACE

Crie uma interface profissional, clara e responsiva, adequada para computadores e celulares.

Use:
- Menu lateral no computador e navegação adaptada no celular.
- Cards de indicadores.
- Tabelas com busca, filtros e paginação.
- Calendário e seleção de período.
- Cores acompanhadas de textos para identificar situações.
- Valores em reais e datas no formato DD/MM/AAAA.
- Horário de referência: America/Sao_Paulo.

O supervisor deve conseguir registrar a situação diária da equipe com poucos cliques.

1. REGRAS FUNDAMENTAIS

Trate separadamente:
- Ausência do funcionário.
- Justificativa da ausência.
- Cobertura do posto.
- Desconto previsto do cliente.
- Custo da cobertura.

Uma ausência justificada pode deixar o posto descoberto. No contrato de teste, a justificativa não elimina o desconto: o desconto depende das horas descobertas.

Não considerar ausência de marcação no PDF como falta automática. Gerar uma divergência para revisão.

Distinguir:
- Efetivo exigido pelo contrato.
- Funcionários ativos vinculados ao contrato.
- Pessoas previstas na escala.
- Pessoas presentes.
- Postos e horas efetivamente cobertos.

2. PERFIS E PERMISSÕES

Criar os perfis:

Administrador:
- Gerencia usuários, contratos, postos, pessoas, valores e configurações.

Supervisor:
- Visualiza somente os contratos sob sua responsabilidade.
- Registra presença, faltas, justificativas e coberturas.
- Envia PDFs e acompanha pendências.

Conferente:
- Revisa documentos, justificativas e divergências.
- Aprova ou corrige registros com histórico.

Financeiro:
- Consulta custos e descontos.
- Registra o desconto aplicado pelo cliente.
- Fecha os períodos.

Aplicar as permissões no banco de dados, utilizando políticas de acesso quando houver Supabase. Não limitar a segurança apenas à ocultação de botões.

Os documentos devem ficar em armazenamento privado, com acesso autorizado. Não criar credenciais públicas inseguras.

3. CADASTROS

Contratos:
- Código, nome, cliente, vigência, supervisor responsável, efetivo exigido e regra de desconto.

Postos:
- Contrato, código, função, turno, horários, intervalo, quantidade exigida, valor por dia/hora e vigência.

Funcionários:
- Matrícula única, nome, função, situação, data de admissão e histórico de vínculo com contratos e postos.

Escalas:
- Funcionário, contrato, posto, data, horários e intervalo.
- Permitir geração de escala para um período.

Diaristas:
- Código, nome, telefone opcional, situação, disponibilidade, valor padrão por diária e por hora.
- Permitir valor específico por cobertura.

Todos os cadastros devem permitir criação e edição. Registros já utilizados devem ser inativados, preservando o histórico.

4. CONFERÊNCIA DIÁRIA

Criar uma tela com seleção de contrato e data, exibindo todos os funcionários previstos na escala.

Permitir registrar:
- Presente.
- Falta integral.
- Falta parcial.
- Folga.
- Férias.
- Afastamento.

Para faltas parciais:
- Informar os intervalos não trabalhados.
- Calcular a duração em minutos e horas.
- Excluir o intervalo de almoço do cálculo.

Registrar a justificativa separadamente:
- Não apresentada.
- Apresentada e pendente.
- Aprovada.
- Rejeitada.

Permitir anexar documento e incluir observações.

Folgas, férias e afastamentos não devem gerar falta do funcionário. A necessidade de cobertura do posto deve ser analisada separadamente conforme a escala contratual.

Permitir preenchimento em lote mediante confirmação. Registros ainda não preenchidos devem continuar como “Não informado”.

Evitar duplicidade de registros para a mesma pessoa, data e jornada.

5. COBERTURAS

Permitir cadastrar a cobertura a partir de uma ausência ou de um posto descoberto.

A cobertura pode ser feita por:
- Diarista cadastrada.
- Outro funcionário da empresa.

Registrar:
- Ocorrência e posto atendidos.
- Pessoa responsável.
- Data.
- Horário inicial e final.
- Intervalo, quando aplicável.
- Horas cobertas.
- Valor combinado.
- Situação: planejada, confirmada, realizada ou cancelada.
- Situação do pagamento: pendente ou pago.

Somente coberturas realizadas devem reduzir as horas descobertas no cálculo final.

Permitir cobertura parcial e várias pessoas cobrindo períodos diferentes da mesma ausência.

Bloquear conflitos de horário da mesma pessoa.

Não contar duas vezes horários sobrepostos. Coberturas devem ser calculadas pela interseção com o período que precisava ser atendido.

Quando um funcionário cobrir outro posto, verificar se seu posto original ficou descoberto. Não considerar a mesma pessoa presente em dois postos simultaneamente.

6. UPLOAD E CONFERÊNCIA DOS PONTOS EM PDF

Criar uma tela para upload de um ou vários PDFs. Um arquivo pode conter um ou vários funcionários.

Armazenar:
- Arquivo original.
- Contrato e período.
- Usuário que enviou.
- Data do envio.
- Situação do processamento.
- Resultado da extração e eventuais erros.

Extrair, quando possível:
- Nome e matrícula.
- Período.
- Datas.
- Marcações de entrada e saída.

Utilizar leitura de texto para PDFs digitais e OCR para PDFs digitalizados, se houver integração disponível.

Usar matrícula como identificador principal. Correspondências incertas por nome devem exigir confirmação.

Identificar:
- Presença informada sem marcações.
- Falta informada com marcações.
- Ausência parcial incompatível com os horários.
- Jornada incompleta.
- Marcações inconsistentes.
- Funcionário de outro contrato.
- Matrícula desconhecida.
- Funcionário esperado sem documento enviado.
- PDF duplicado.
- Documento ilegível ou extração incerta.

Criar uma fila de divergências, mostrando lado a lado:
- Registro do supervisor.
- Marcações extraídas.
- Documento original e página de origem.
- Motivo da divergência.
- Ação para resolver e comentário obrigatório quando houver alteração.

A extração não deve alterar automaticamente os registros aprovados.

Se OCR ou análise automática depender de serviço externo, implementar a estrutura de integração e informar a configuração necessária. Disponibilizar conferência manual enquanto isso.

Não simular leitura de PDFs reais. Dados demonstrativos devem estar explicitamente identificados como simulação.

7. CONFERÊNCIA DO EFETIVO

Por contrato e data, exibir:
- Efetivo contratual.
- Funcionários ativos vinculados.
- Pessoas previstas na escala.
- Pessoas presentes.
- Pessoas em cobertura.
- Postos integralmente cobertos.
- Postos parcialmente cobertos.
- Postos sem cobertura.
- Horas exigidas, atendidas e descobertas.

Comparar a relação esperada de funcionários com as pessoas identificadas nos PDFs.

Não concluir que o efetivo está correto apenas contando nomes nos documentos. Exibir separadamente pessoas únicas e cobertura dos postos por horário.

8. CÁLCULOS FINANCEIROS

Permitir regras de desconto por hora, diária ou turno, com valores e vigências configuráveis.

Para o contrato fictício:
- Cada posto vale R$ 180,00 por dia.
- Jornada de 8 horas.
- Hora descoberta: R$ 22,50.
- Diarista: R$ 130,00 por 8 horas.
- Cobertura parcial: R$ 16,25 por hora, salvo valor específico informado.

Fórmulas:
- Horas descobertas = horas exigidas não atendidas por presença ou cobertura válida.
- Desconto previsto = horas descobertas × valor da hora do posto.
- Custo das coberturas = soma dos valores das coberturas realizadas.
- Impacto financeiro das ocorrências = desconto previsto + custo das coberturas.

Não apresentar esse impacto como lucro ou margem do contrato.

Calcular a duração em minutos e valores com precisão monetária, evitando erros de arredondamento. Exibir valores com duas casas decimais.

Preservar os valores históricos usados nos registros e fechamentos, mesmo que os preços dos cadastros sejam alterados posteriormente.

Permitir informar:
- Desconto efetivamente aplicado pelo cliente.
- Diferença em relação ao previsto.
- Motivo da diferença.
- Documento de suporte opcional.

Mostrar valores provisórios e revisados separadamente.

9. PAINEL E RELATÓRIOS

Criar estas páginas:
- Painel geral.
- Contratos.
- Postos.
- Funcionários.
- Escalas.
- Diaristas.
- Conferência diária.
- Coberturas.
- Documentos de ponto.
- Divergências.
- Relatórios.
- Fechamentos.
- Usuários e configurações.

No painel, mostrar:
- Dias sem conferência.
- Ausências integrais e parciais.
- Justificativas pendentes.
- Coberturas pendentes.
- Postos descobertos.
- Divergências abertas.
- Desconto previsto.
- Custo das coberturas.

Relatórios com filtros por contrato, período, funcionário, posto e diarista:
- Ausências e justificativas.
- Cobertura de cada ausência.
- Períodos descobertos.
- Custos e pagamentos das diaristas.
- Efetivo previsto versus realizado.
- Divergências.
- Desconto previsto versus aplicado.

Distinguir quantidade de ocorrências, dias distintos e horas ausentes. Não somar faltas parciais como se fossem dias inteiros.

Permitir exportação em CSV e PDF.

10. REVISÃO E FECHAMENTO

Implementar o fluxo:
Supervisor registra → conferente revisa → financeiro fecha.

Bloquear fechamento quando houver registros não informados ou divergências que afetem o cálculo.

Após fechamento:
- Bloquear alterações comuns.
- Permitir reabertura somente por usuário autorizado.
- Exigir motivo.
- Registrar autor, data, valores anteriores e novos valores.

Manter histórico das alterações relevantes.

11. DADOS FICTÍCIOS PARA TESTE

Criar uma rotina que carregue os dados demonstrativos sem duplicá-los quando executada novamente.

Cadastrar:
- Contrato: Contrato Teste.
- Código: CT-001.
- Cliente: Tomador Fictício.
- Efetivo exigido: 30 serventes de limpeza.
- Postos: P01 a P30, com uma pessoa por posto.
- Funcionários: Servente Teste 01 a Servente Teste 30.
- Matrículas: ST001 a ST030.
- Cada funcionário vinculado ao posto correspondente.
- Supervisor: Supervisor Teste.
- Diaristas: Diarista Teste 01 a Diarista Teste 05.
- Escala de segunda a sexta, das 08h às 17h.
- Intervalo das 12h às 13h.
- Jornada efetiva de 8 horas.
- Período de teste: outubro de 2026.

Para a demonstração, considerar os dias de segunda a sexta como dias de operação, sem aplicar calendário de feriados. Permitir configuração posterior do calendário de cada contrato.

Não inventar CPF ou documentos pessoais reais. Marcar todos os dados como fictícios.

12. CENÁRIOS DO DIA 05/10/2026

Preparar os seguintes registros:

ST001:
- Falta integral, sem justificativa e sem cobertura.
- 8 horas descobertas.
- Desconto: R$ 180,00.

ST002:
- Falta integral, sem justificativa.
- Cobertura integral realizada pela Diarista Teste 01.
- Desconto: R$ 0,00.
- Custo da cobertura: R$ 130,00.

ST003:
- Falta integral com justificativa aprovada, sem cobertura.
- Desconto: R$ 180,00.

ST004:
- Falta integral com justificativa aprovada.
- Cobertura integral realizada pela Diarista Teste 02.
- Desconto: R$ 0,00.
- Custo da cobertura: R$ 130,00.

ST005:
- Falta parcial das 13h às 17h, sem cobertura.
- Desconto: R$ 90,00.

ST006:
- Falta parcial das 13h às 17h.
- Diarista Teste 03 cobre das 13h às 15h.
- 2 horas descobertas.
- Desconto: R$ 45,00.
- Custo da cobertura: R$ 32,50.

ST007:
- Presença registrada.
- Dados de ponto demonstrativos sem marcações.
- Gerar divergência para revisão, sem desconto automático.

ST008:
- Presença registrada.
- Dados de ponto demonstrativos com jornada incompleta.
- Gerar divergência para revisão, sem desconto automático.

ST009 a ST030:
- Presença regular.

Resultados esperados das seis ausências:
- 4 faltas integrais.
- 2 faltas parciais.
- 40 horas de ausência.
- 18 horas cobertas.
- 22 horas descobertas.
- Desconto previsto: R$ 495,00.
- Custo das coberturas: R$ 292,50.
- Impacto financeiro: R$ 787,50.

O total do dia deve permanecer provisório até a revisão de ST007 e ST008.

Criar exemplos adicionais, separados desses totais, para testar:
- PDF duplicado.
- Matrícula desconhecida.
- Funcionário sem documento enviado.
- Cobertura com conflito de horário.
- Tentativa de edição após fechamento.

13. IMPLEMENTAÇÃO E VALIDAÇÃO

Organize a implementação em etapas dentro deste projeto:
1. Banco, autenticação e permissões.
2. Cadastros e dados fictícios.
3. Escalas, presença e coberturas.
4. Cálculos e painel.
5. Upload, extração e divergências.
6. Relatórios e fechamento.

Mantenha os cálculos centralizados e consistentes entre telas, relatórios e exportações.

Verifique:
- Os totais financeiros do exemplo.
- O cálculo de cobertura parcial.
- A exclusão do intervalo de almoço.
- O bloqueio de conflitos e duplicidades.
- A persistência dos registros.
- As permissões por contrato.
- O bloqueio após fechamento.

Ao terminar, informe:
- O que está funcional.
- Como acessar o contrato demonstrativo.
- Quais integrações precisam de configuração.
- Quais funcionalidades ainda estão pendentes.

Comece a implementar a aplicação, tomando decisões técnicas coerentes com estes requisitos.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8d4eb348-17d6-4c3f-a3b3-b841aa64e53d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
