/* Cérebro da Lube — js/fala.js
   O texto que vai para a voz do Jarvis (e para a legenda): sem markdown, sem URL, sem emoji, sem marcadores de lista.
   Módulo sem dependência e sem DOM: a página usa para falar (js/jarvis.js) e o servidor usa para achar, no texto bruto
   que o Claude escreveu, o ponto exato em que o Júlio interrompeu (servidor/conversa.js). Os dois lados precisam limpar
   do mesmo jeito, senão a fala cortada não casa com o registro do turno. */

export function limparFala(s) {
  return String(s || '')
    .replace(/https?:\/\/\S+/gi, 'o link')
    .replace(/\*\*|__|`+|^#+\s*|^\s*[-*•]\s+/gm, '')
    .replace(/^\s*\d{1,3}[.)]\s+/gm, '')                       // "1. " de lista numerada: não se fala o número sozinho
    .replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, '$1')
    .replace(/\s[*_]+(?=\s)/g, ' ')                            // asterisco ou sublinhado soltos
    .replace(/(^|[\s(["'“])[*_]+(?=\S)/g, '$1')                // *ênfase* e _ênfase_: tira a marca do começo…
    .replace(/(\S)[*_]+(?=[\s.,;:!?)\]"'”]|$)/g, '$1')         // …e a do fim
    .replace(/\s*\|\s*/g, ' ')                                 // barras de tabela
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
