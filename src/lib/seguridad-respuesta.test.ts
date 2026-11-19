import assert from "node:assert/strict";
import test from "node:test";
import { bloquearCobroNoVerificado, precioNoRegistrado, promocionVigente } from "./seguridad-respuesta";

test("no manda monto de envío antiguo ni datos de pago de pedido con envío", () => {
  const history = [{role:"user",content:"Quiero envío al 54480"}];
  assert.equal(bloquearCobroNoVerificado("Serum $229 más envío $120, total $349",history),true);
  assert.equal(bloquearCobroNoVerificado("Te paso la CLABE para pagar",history),true);
  assert.equal(bloquearCobroNoVerificado("Un asesor confirma el envío y el total antes del pago",history),false);
  assert.equal(bloquearCobroNoVerificado("El producto cuesta $250",history),false);
  assert.equal(bloquearCobroNoVerificado("La CLABE es...",[{role:"user",content:"Pago en tienda"}]),false);
});

test("solo acepta importes actuales y la oferta vence al comenzar el 18", () => {
  const promo = "[vigente-hasta:2026-11-17] con dermaroller $996, sin dermaroller $896";
  assert.equal(promocionVigente(promo,true,"2026-11-17"),true);
  assert.equal(promocionVigente(promo,true,"2026-11-18"),false);
  assert.equal(precioNoRegistrado("La promoción cuesta $996",[promo]),false);
  assert.equal(precioNoRegistrado("La promoción cuesta $1,300",[promo]),true);
  assert.equal(precioNoRegistrado("Cuesta 600 pesos",["$650 MXN"]),true);
});
