/* Cérebro da Lube — servidor/validar.js
   Validação do input das ferramentas contra o próprio JSON Schema delas, antes de rodar.
   Com eager_input_streaming a API não valida nem corrige o input, e o leitor tolerante da SDK pode devolver um objeto
   cortado: por isso nada roda sem passar aqui (skill claude-api, "Eager input streaming").
   Cobre o subconjunto que as ferramentas usam: type, properties, required, additionalProperties:false, enum,
   minLength/maxLength, minimum/maximum, items, minItems/maxItems. */

function tipoDe(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function confere(schema, v, onde, erros) {
  if (!schema || erros.length > 8) return;
  const t = tipoDe(v);
  if (schema.type) {
    const aceitos = Array.isArray(schema.type) ? schema.type : [schema.type];
    const ok = aceitos.some(a => a === t || (a === 'number' && t === 'integer'));
    if (!ok) { erros.push(`${onde}: esperado ${aceitos.join(' ou ')}, veio ${t}`); return; }
  }
  if (schema.enum && !schema.enum.includes(v)) { erros.push(`${onde}: valor fora da lista (${schema.enum.join(', ')})`); return; }
  if (t === 'string') {
    if (schema.minLength != null && v.length < schema.minLength) erros.push(`${onde}: texto curto demais`);
    if (schema.maxLength != null && v.length > schema.maxLength) erros.push(`${onde}: texto longo demais (máx. ${schema.maxLength})`);
  }
  if (t === 'integer' || t === 'number') {
    if (schema.minimum != null && v < schema.minimum) erros.push(`${onde}: menor que ${schema.minimum}`);
    if (schema.maximum != null && v > schema.maximum) erros.push(`${onde}: maior que ${schema.maximum}`);
  }
  if (t === 'array') {
    if (schema.minItems != null && v.length < schema.minItems) erros.push(`${onde}: precisa de pelo menos ${schema.minItems} item(ns)`);
    if (schema.maxItems != null && v.length > schema.maxItems) erros.push(`${onde}: no máximo ${schema.maxItems} itens`);
    if (schema.items) v.forEach((x, i) => confere(schema.items, x, `${onde}[${i}]`, erros));
  }
  if (t === 'object') {
    const props = schema.properties || {};
    for (const r of schema.required || []) if (!(r in v)) erros.push(`${onde}.${r}: obrigatório`);
    for (const [k, x] of Object.entries(v)) {
      if (props[k]) confere(props[k], x, `${onde}.${k}`, erros);
      else if (schema.additionalProperties === false) erros.push(`${onde}.${k}: campo desconhecido`);
    }
  }
}

/** Devolve a lista de erros (vazia = válido). */
export function validar(schema, valor, onde = 'input') {
  const erros = [];
  confere(schema, valor, onde, erros);
  return erros;
}
