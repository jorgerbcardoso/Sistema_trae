export function calcDvMod11(value: string | number): number {
  const s = String(value ?? '').replace(/\D/g, '');
  if (!s) return 0;
  let peso = 2;
  let soma = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const d = Number(s[i]) || 0;
    soma += d * peso;
    peso++;
    if (peso > 9) peso = 2;
  }
  const mod = soma % 11;
  let dv = 11 - mod;
  if (dv === 10 || dv === 11) dv = 0;
  return dv;
}

export function formatNroCte6(nro: string | number): string {
  const n = String(nro ?? '').replace(/\D/g, '');
  if (!n) return '';
  return n.padStart(6, '0');
}

export function splitCteBase(cte: string): { ser: string; nro: string } | null {
  const s = String(cte ?? '').trim().toUpperCase();
  if (!s) return null;
  const noDv = s.split('-')[0] ?? '';
  const m = noDv.match(/^([A-Z0-9]{3})(\d{1,})$/);
  if (!m) return null;
  return { ser: m[1], nro: m[2] };
}

export function formatCteBase(ser: string, nro: string | number): string {
  const serN = String(ser ?? '').trim().toUpperCase();
  const nro6 = formatNroCte6(nro);
  if (!serN || !nro6) return '';
  return `${serN}${nro6}`;
}

export function formatCteComDv(ser: string, nro: string | number): string {
  const base = formatCteBase(ser, nro);
  if (!base) return '';
  const dv = calcDvMod11(nro);
  return `${base}-${dv}`;
}

export function formatCteComDvFromAny(input: {
  ctrc?: string;
  cte?: string;
  serCte?: string;
  ser_cte?: string;
  nroCte?: string | number;
  nro_cte?: string | number;
}): string {
  const ser = (input.serCte ?? input.ser_cte ?? '').toString();
  const nro = input.nroCte ?? input.nro_cte ?? '';
  const direct = formatCteComDv(ser, nro);
  if (direct) return direct;
  const raw = String(input.ctrc ?? input.cte ?? '').trim();
  const parts = splitCteBase(raw);
  if (parts) return formatCteComDv(parts.ser, parts.nro);
  return raw;
}

