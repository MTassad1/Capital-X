from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def calculate_price(
    unit_cost: Decimal,
    sales_fee_rate: Decimal,
    target_margin: Decimal,
) -> dict:
    """Calcula preço para margem desejada sobre o preço de venda."""
    if unit_cost < 0:
        raise ValueError("O custo unitário não pode ser negativo.")
    if not (Decimal("0") <= sales_fee_rate < Decimal("1")):
        raise ValueError("A taxa sobre a venda deve estar entre 0% e 100%.")
    if not (Decimal("0") <= target_margin < Decimal("1")):
        raise ValueError("A margem desejada deve estar entre 0% e 100%.")

    denominator = Decimal("1") - sales_fee_rate - target_margin
    if denominator <= 0:
        raise ValueError("Taxas e margem não deixam espaço para cobrir o custo.")

    price = unit_cost / denominator
    fees = price * sales_fee_rate
    unit_result = price - unit_cost - fees

    return {
        "custo_unitario": str(money(unit_cost)),
        "preco_sugerido": str(money(price)),
        "taxas_estimadas": str(money(fees)),
        "resultado_unitario_antes_de_outros_custos": str(money(unit_result)),
        "margem_calculada": str(
            (unit_result / price).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            if price else Decimal("0")
        ),
        "aviso": (
            "Estimativa simplificada. Confirme custos fixos, impostos, comissões, "
            "frete, descontos e regras tributárias antes de usar comercialmente."
        ),
    }
