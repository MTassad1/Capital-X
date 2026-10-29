from decimal import Decimal
from app.finance.pricing import calculate_price


def test_calculo_de_exemplo():
    result = calculate_price(Decimal("40.00"), Decimal("0.10"), Decimal("0.25"))
    assert result["preco_sugerido"] == "61.54"
    assert result["taxas_estimadas"] == "6.15"
    assert result["resultado_unitario_antes_de_outros_custos"] == "15.38"


def test_rejeita_taxa_e_margem_impossiveis():
    try:
        calculate_price(Decimal("40"), Decimal("0.50"), Decimal("0.50"))
    except ValueError:
        pass
    else:
        raise AssertionError("Era esperado ValueError")
