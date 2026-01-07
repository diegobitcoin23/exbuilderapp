
export const TIKTOK_GUIDELINES = `
DIRETRIZES DA COMUNIDADE DO TIKTOK (2025) - ATUALIZAÇÃO RIGOROSA

1. SEGURANÇA E CIVILIDADE:
- Comportamento violento/criminoso: Proibido ameaças, atos violentos, promoção de crimes.
- Discurso de ódio: Proibido ódio baseado em raça, religião, gênero, orientação sexual.
- Organizações violentas: Proibido apoio a extremistas ou criminosos.
- Abuso de jovens/adultos: Proibido conteúdo sexual ou exploração de menores e adultos.
- Assédio e Bullying: Proibido doxing, comentários degradantes, assédio sexual.

2. SAÚDE MENTAL E COMPORTAMENTAL:
- Suicídio e automutilação: Proibido mostrar ou promover.
- Distúrbios alimentares: Proibido promover métodos de risco para perda de peso ou imagem corporal prejudicial.
- Atividades perigosas: Proibido desafios (challenges) que resultem em danos físicos.

3. TEMAS SENSÍVEIS:
- Exposição do corpo/sexual: Proibido nudez, serviços sexuais, comportamento sexualmente sugestivo.
- Conteúdo explícito: Proibido violência extrema ou perturbadora.
- Abuso animal: Proibido crueldade ou exploração de animais.

4. INTEGRIDADE E AUTENTICIDADE:
- Desinformação: Proibido mentiras que causem danos sociais.
- Integridade Eleitoral: Proibido desinformação sobre votos ou eleições.
- Conteúdo IA (AIGC): Obrigatório rótulo de IA. Proibido IA que induza ao erro sobre pessoas reais em cenas sensíveis.
- Direitos Autorais: Proibido uso não autorizado de propriedade intelectual.

5. PRODUTOS REGULAMENTADOS E COMERCIAIS:
- Bens proibidos: Marketing de itens de alto risco ou proibidos.
- Divulgação Comercial: Obrigatório usar tag de "parceria paga".
- Fraudes: Proibido golpes e esquemas enganosos.

MODERAÇÃO EXTREMA:
- O algoritmo do TikTok em 2025 está focando em "Safety-First". Pequenas infrações levam a "Shadowban".
- O uso de áudios que contenham palavras banidas (mesmo que de fundo) causa retenção do FYP.
`;

export const SYSTEM_PROMPT = `
Você é o Auditor Master exbuilderIA, versão 2025.
Sua missão é realizar uma auditoria de TOLERÂNCIA ZERO e auxiliar na construção de conteúdo seguro.

INSTRUÇÕES DE RIGOR:
1. USE GOOGLE SEARCH: Pesquise por "TikTok recent banned challenges 2025" ou "novas restrições TikTok [mês atual]" para cruzar com o vídeo.
2. ANÁLISE MULTIMODAL: Verifique frames, texto sobreposto, vestuário, objetos no fundo e áudio.
3. DETECÇÃO DE NUANCES: Identifique comportamentos "borderline" (no limite da regra) que podem ser interpretados como sexualizados ou perigosos para menores.
4. RÓTULOS DE IA: Se o vídeo parece gerado por IA e não possui rótulo, marque como VIOLAÇÃO DE INTEGRIDADE.

FORMATO DE RESPOSTA (JSON):
{
  "overallStatus": "Pass" | "Warning" | "Fail",
  "riskScore": number (0-100),
  "summary": "Resumo crítico detalhado",
  "findings": [
    {
      "category": "Categoria",
      "issue": "Problema específico",
      "severity": "Low" | "Medium" | "High",
      "recommendation": "Ação corretiva",
      "guidelineReference": "Artigo da diretriz"
    }
  ],
  "isEligibleForFYP": boolean
}
`;
