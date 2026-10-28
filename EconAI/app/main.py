import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Optional
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.finance.pricing import calculate_price

load_dotenv()

app = FastAPI(
    title="Capital-X | EconAI",
    description="Protótipo de dashboard financeiro com assistente EconAI.",
    version="0.2.0",
)

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Armazenamento temporário apenas para demonstração local.
# Substituir por PostgreSQL e autenticação antes de uso real.
REPORTS = []


class PricingRequest(BaseModel):
    custo_unitario: Decimal = Field(ge=0)
    taxa_venda: Decimal = Field(ge=0, lt=1, description="10% = 0.10")
    margem_desejada: Decimal = Field(ge=0, lt=1, description="25% = 0.25")


class ChatRequest(BaseModel):
    mensagem: str = Field(min_length=1, max_length=4000)
    contexto: Optional[str] = Field(default=None, max_length=5000)


class ReportRequest(BaseModel):
    titulo: str = Field(min_length=2, max_length=120)
    periodo: str = Field(min_length=2, max_length=80)
    resumo: str = Field(min_length=5, max_length=5000)
    indicadores: dict = Field(default_factory=dict)


@app.get("/")
def home():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health():
    return {"status": "ok", "empresa": "Capital-X", "assistente": "EconAI"}


@app.post("/api/precificacao")
def precificacao(request: PricingRequest):
    try:
        return calculate_price(
            unit_cost=request.custo_unitario,
            sales_fee_rate=request.taxa_venda,
            target_margin=request.margem_desejada,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/relatorios")
def listar_relatorios():
    return {"relatorios": REPORTS}


@app.post("/api/relatorios")
def criar_relatorio(request: ReportRequest):
    report = {
        "id": str(uuid4()),
        "titulo": request.titulo,
        "periodo": request.periodo,
        "resumo": request.resumo,
        "indicadores": request.indicadores,
        "criado_em": datetime.now(timezone.utc).isoformat(),
        "origem": "EconAI / protótipo",
    }
    REPORTS.insert(0, report)
    return report


@app.post("/api/chat")
def conversar(request: ChatRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_MODEL", "")

    if not api_key or not model:
        return {
            "resposta": (
                "A EconAI está pronta para receber a configuração do modelo. "
                "Adicione OPENAI_API_KEY e OPENAI_MODEL ao arquivo .env. "
                "O dashboard e o motor de precificação funcionam sem essa configuração."
            ),
            "modo": "configuracao_necessaria",
        }

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        instrucoes = """
Você é EconAI, assistente de finanças empresariais da Capital-X.
Fale em português do Brasil com tom profissional, claro, minimalista e prudente.
Ajude a interpretar receitas, custos, margens, fluxo de caixa e precificação.
Não invente dados, não alegue que realizou ações que não realizou e diferencie
fatos, estimativas e hipóteses. Pergunte quando faltarem informações.
Neste protótipo, você não tem ferramentas para alterar dados financeiros nem
executar ações externas. Nunca solicite senhas, tokens bancários ou segredos.
Para questões tributárias, jurídicas ou de alto impacto, recomende validação
com profissional qualificado.
"""
        entrada = request.mensagem
        if request.contexto:
            entrada += "\n\nContexto informado pelo usuário:\n" + request.contexto

        response = client.responses.create(
            model=model,
            instructions=instrucoes,
            input=entrada,
        )
        return {"resposta": response.output_text, "modo": "ia"}
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="A EconAI não conseguiu responder. Verifique a configuração do modelo e tente novamente.",
        )
