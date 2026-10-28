# Capital-X | EconAI — MVP

Protótipo local com dashboard minimalista, chat da EconAI, calculadora de precificação
e área para criar e visualizar relatórios no dashboard.

## Requisitos

Python 3.11+ recomendado.

## Instalação no Windows (PowerShell)

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Para habilitar o chat, edite `.env`, defina `OPENAI_API_KEY` e `OPENAI_MODEL`
com uma chave e um modelo disponíveis para seu projeto/conta. Não coloque a chave
em HTML/JavaScript, Git ou mensagens públicas.

Inicie o servidor:

```powershell
uvicorn app.main:app --reload
```

Abra http://127.0.0.1:8000. Documentação da API: http://127.0.0.1:8000/docs

Testes:

```powershell
pytest
```

## O que já funciona

- Dashboard de demonstração com métricas fictícias e gráfico ilustrativo.
- Chat EconAI conectado à API quando configurado.
- Calculadora de precificação no backend.
- Criação e listagem de relatórios durante a sessão do servidor.

## Limitações e próximos passos

Este MVP não é pronto para clientes nem para produção. Ainda não possui login,
controle de acesso por organização, banco persistente, trilha de auditoria,
gestão de consentimento, monitoramento, rate limiting, nem revisão de segurança.
Relatórios ficam apenas em memória e somem quando o servidor reinicia.
A IA não pode criar relatórios por conta própria nem executar ações externas nesta versão.
Os números do dashboard são exemplos fictícios. Não use dados financeiros reais
até implementar autenticação, isolamento por empresa, banco de dados e segurança.
