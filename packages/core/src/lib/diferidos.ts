/** Estimación de cuotas con tasa nominal anual dividida entre 12. */
export function calcularDiferido(monto: number, meses: number, tasaAnual = 0) {
  if (!Number.isFinite(monto) || monto <= 0 || !Number.isInteger(meses) || meses < 1 || meses > 24 ||
      !Number.isFinite(tasaAnual) || tasaAnual < 0 || tasaAnual > 999.99) {
    throw new Error("Revisa el monto, plazo y tasa anual del diferido.");
  }
  const capitalInicial = Math.round(monto * 100);
  const tasaMensual = tasaAnual / 1200;
  const pagoTeorico = tasaMensual === 0
    ? monto / meses
    : monto * tasaMensual / (1 - (1 + tasaMensual) ** -meses);
  const cuotaCentavos = Math.ceil(pagoTeorico * 100 - 1e-8);
  let capitalCentavos = capitalInicial;
  let interesTotalCentavos = 0;
  const cuotas = Array.from({ length: meses }, (_, indice) => {
    const interesCentavos = Math.round(capitalCentavos * tasaMensual);
    const capitalPagadoCentavos = indice === meses - 1
      ? capitalCentavos
      : Math.min(capitalCentavos, Math.max(0, cuotaCentavos - interesCentavos));
    capitalCentavos -= capitalPagadoCentavos;
    interesTotalCentavos += interesCentavos;
    return {
      numero: indice + 1,
      capital: capitalPagadoCentavos / 100,
      interes: interesCentavos / 100,
      total: (capitalPagadoCentavos + interesCentavos) / 100,
    };
  });
  return {
    cuotaMensual: cuotaCentavos / 100,
    primeraCuota: cuotas[0],
    cuotas,
    interesTotal: interesTotalCentavos / 100,
    totalEstimado: (capitalInicial + interesTotalCentavos) / 100,
  };
}
