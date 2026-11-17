const DIAS: Record<string, number> = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};

export function consultaHorario(texto: string): boolean {
  const t = texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  if (/\b(?:envio|envios|entrega|entregas|paqueteria|reparto)\b/.test(t) && !/\b(?:sucursal|local|tienda|guelatao)\b/.test(t)) return false;
  return /\bhorarios?\b|\b(?:abren|cierran|apertura|cierre)\b|\b(?:esta|estan|tienen|siguen)\s+abiert[oa]s?\b|\ba\s+que\s+hora\s+(?:abren|cierran|abres|cierras)\b/.test(t);
}

export function respuestaHorario(ahora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-US", {timeZone:"America/Mexico_City",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(ahora);
  const parte = (tipo:string) => partes.find(p=>p.type===tipo)?.value ?? "";
  const dia = DIAS[parte("weekday")];
  const minutos = Number(parte("hour"))*60 + Number(parte("minute"));
  const abierto = dia >= 2 && dia <= 6 && minutos >= 12*60+30 && minutos < 16*60+30;
  const horario = "Nuestro horario en sucursal Plaza Guelatao es de martes a sábado, de 12:30 pm a 4:30 pm. Domingo y lunes está cerrado.";
  return abierto
    ? `${horario}\n\nSi quieres, te confirmo la existencia del producto que buscas antes de que vengas.`
    : `En este momento la sucursal está cerrada. ${horario}\n\nPuedes comprar en línea en https://maximus-inc.com.mx/ con envío a todo México, o dejar tu mensaje para atenderte en horario de sucursal.`;
}
