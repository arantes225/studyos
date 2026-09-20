function classifyAnswerTilePixel(
  red,
  green,
  blue
) {
  /*
    Códigos:
    1 = vermelho  → erro
    2 = verde     → acerto
    3 = selecionada / estado especial

    Suporta agora:
    - verdes saturados como #22C55E
    - vermelhos saturados como #EF4444
    - verdes/vermelhos mais claros do padrão anterior
    - azul de seleção #3B82F6
    - amarelo-claro de seleção #FEF2D3
  */

  red = Number(red);
  green = Number(green);
  blue = Number(blue);


  /* ================================
     VERDE — ACERTO
     ================================ */

  const vividGreen =
    green >= 145
    && green >= red + 25
    && green >= blue + 20;

  const strongGreen =
    green >= 155
    && red <= 110
    && blue <= 145;


  if (
    vividGreen
    || strongGreen
  ) {
    return 2;
  }


  /* ================================
     VERMELHO — ERRO
     ================================ */

  const vividRed =
    red >= 170
    && red >= green + 35
    && red >= blue + 35;

  const strongRed =
    red >= 190
    && green <= 130
    && blue <= 130;


  if (
    vividRed
    || strongRed
  ) {
    return 1;
  }


  /* ================================
     AZUL — QUESTÃO SELECIONADA
     ================================ */

  const selectedBlue =
    blue >= 145
    && blue >= red + 30
    && blue >= green + 18
    && red <= 190;


  if (
    selectedBlue
  ) {
    return 3;
  }


  /* ================================
     AMARELO CLARO — FUNDO DA
     QUESTÃO SELECIONADA

     Exemplo do print:
     ~ #FEF2D3
     ================================ */

  const selectedYellow =
    red >= 235
    && green >= 210
    && blue >= 150
    && blue <= 235
    && red - blue >= 15
    && green - blue >= 5;


  if (
    selectedYellow
  ) {
    return 3;
  }


  return 0;
}