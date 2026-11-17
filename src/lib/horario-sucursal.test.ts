import assert from "node:assert/strict";
import test from "node:test";
import { consultaHorario,respuestaHorario } from "./horario-sucursal";

test("contesta horario conforme al reloj de Ciudad de México",()=>{
  for (const text of ["¿Cuál es el horario?","¿Están abiertos?","¿A qué hora cierran?"]) assert.equal(consultaHorario(text),true);
  assert.equal(consultaHorario("¿Tienen minoxidil?"),false);
  assert.equal(consultaHorario("¿En qué horario hacen entregas?"),false);
  assert.match(respuestaHorario(new Date("2026-11-10T18:29:00Z")),/sucursal está cerrada/);
  assert.doesNotMatch(respuestaHorario(new Date("2026-11-10T18:30:00Z")),/sucursal está cerrada/);
  assert.match(respuestaHorario(new Date("2026-11-10T22:30:00Z")),/sucursal está cerrada/);
  assert.match(respuestaHorario(new Date("2026-11-09T20:00:00Z")),/sucursal está cerrada/);
  assert.match(respuestaHorario(new Date("2026-11-15T20:00:00Z")),/sucursal está cerrada/);
  assert.match(respuestaHorario(new Date("2026-11-10T23:00:00Z")),/maximus-inc\.com\.mx/);
});
