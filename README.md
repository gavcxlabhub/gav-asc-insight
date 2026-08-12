# GAV ASC Insights

Crie com supabase e github conectado a estrutura completa de uma plataforma corporativa chamada GAV ASC Analytics para análise de atendimentos WhatsApp da GAV Resorts via plataforma ASC.

IDENTIDADE VISUAL

Paleta: azul escuro #012e59, branco, dourado #c9a227 para destaques, tons neutros para fundos

Aparência executiva de Business Intelligence
Responsivo para desktop e notebook

Fonte principal: Inter

AUTENTICAÇÃO

Login com email e senha via Supabase Auth

Dois perfis: admin e visualizador

Tabela profiles vinculada ao auth.users com campos: id, nome, email, ativo, role, created_at

RLS ativo em todas as tabelas — nenhum acesso anônimo

Primeiro usuário cadastrado vira admin automaticamente

Admin pode convidar novos usuários por email

Usuário convidado precisa de aprovação do admin para acessar

Tela de login com recuperação de senha

BANCO DE DADOS — criar todas as migrations automaticamente

Tabela atendimentos:

id uuid PRIMARY KEY DEFAULT gen_random_uuid()
protocolo text
source_record_key text UNIQUE -- chave técnica determinística
agente text
conta text
servico text
contato text
telefone text
numero_externo text
canal text DEFAULT 'Whatsapp'
data_entrada timestamptz
data_atendimento timestamptz
data_fila timestamptz
data_finalizacao timestamptz
primeira_mensagem_agente timestamptz
tempo_em_fila text
tempo_atendimento text
tempo_pendencia text
tmic text
tmia text
status text
tipo text -- 'Humano', 'Misto', 'Automático'
ativo_receptivo text -- 'Ativo', 'Receptivo'
classificacao_origem text
recorrencia_origem text -- valor original da ASC
tag text
prioritario text
qic text
qia text
protocolo_dependente text
atendimento_original text
ferramenta text DEFAULT 'ASC'
arquivo_origem text
importacao_id uuid REFERENCES importacoes(id) ON DELETE CASCADE
dados_origem jsonb
created_at timestamptz DEFAULT now()


Tabela importacoes:

id uuid PRIMARY KEY DEFAULT gen_random_uuid()
nome_arquivo text
periodo_inicio timestamptz
periodo_fim timestamptz
total_lido integer DEFAULT 0
registros_novos integer DEFAULT 0
duplicados integer DEFAULT 0
invalidos integer DEFAULT 0
usuario_id uuid REFERENCES auth.users(id)
created_at timestamptz DEFAULT now()


Índices obrigatórios:

CREATE INDEX ON atendimentos (data_entrada);
CREATE INDEX ON atendimentos (conta);
CREATE INDEX ON atendimentos (agente);
CREATE INDEX ON atendimentos (ferramenta);
CREATE INDEX ON atendimentos (recorrencia_origem);
CREATE INDEX ON atendimentos (importacao_id);
CREATE UNIQUE INDEX ON atendimentos (source_record_key);


IMPORTAÇÃO

Botão Adicionar Base de Dados visível apenas para admin

Aceitar CSV, XLS, XLSX

Detectar automaticamente colunas pelo nome do cabeçalho — sem configuração manual

Reconhecer os campos da ASC: Agente, Conta, Serviço, Contato, Telefone, Número externo, Protocolo, Canal, Data de Entrada, Data de Atendimento, Primeira Mensagem (Agente), Data de fila, Tempo em Fila, Tempo de Atendimento, TMIC, TMIA, Status, Tipo, Classificação, Recorrência, Data de finalização, Ativo/Receptivo?, QIC, QIA, Protocolo dependente, Tag

Gerar source_record_key como hash determinístico de: protocolo + telefone_normalizado + data_entrada + conta + agente

Usar upsert com onConflict: 'source_record_key' e ignoreDuplicates: true

Processar em lotes de 500 registros

Mostrar progresso: Lendo → Validando → Identificando duplicatas → Salvando → Concluído

Mostrar resumo: total lido, novos, duplicados, inválidos

Gravar registro na tabela importacoes

TRATAMENTO DOS DADOS NA IMPORTAÇÃO

Campo tipo: preservar valor original da ASC ('Humano', 'Misto', 'Automático')

Campo ativo_receptivo: normalizar para 'Ativo' ou 'Receptivo'

Campo recorrencia_origem: preservar valor original sem recalcular

Campo telefone: armazenar como texto preservando zeros à esquerda

Datas em serial Excel (número como 46234.99) converter para ISO corretamente

Datas em string converter para ISO

NAVEGAÇÃO Criar as seguintes rotas protegidas (sem conteúdo ainda — apenas estrutura com placeholder):

/ → Visão Executiva

/recorrencia → Recorrência

/contas → Contas / Departamentos

/servicos → Serviços

/agentes → Agentes

/horarios → Horários de Pico

/gerenciar → Gerenciar Base (admin)

/usuarios → Gerenciar Usuários (admin)

Menu lateral ou top nav com todas as rotas. Ícones para cada página.

SHELL DA APLICAÇÃO

Header com logo GAV ASC Analytics

Badge mostrando se há base carregada

Menu de usuário com nome, perfil e botão Sair

Componente EmptyState para quando não há dados importados

IMPORTANTE

Nunca buscar toda a tabela atendimentos no frontend

Todos os cálculos de KPI devem ser feitos via queries agregadas no Supabase

Usar React Query com staleTime de 5 minutos

TypeScript strict sem erros

Não criar dados fictícios ou mock — apenas dados reais importados

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gav-asc-insight.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7634117b-02b2-47d0-876a-e37f1c369e68).

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
