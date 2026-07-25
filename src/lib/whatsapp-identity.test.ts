import assert from "node:assert/strict";
import test from "node:test";
import {
  exportablePhone,
  isAuthorizedAddress,
  preferredPhoneJid,
} from "./whatsapp-identity";

test("authorizes the personal owner phone when WhatsApp puts it in remoteJidAlt", () => {
  assert.equal(
    isAuthorizedAddress(
      {
        remoteJid: "123456789012345@lid",
        remoteJidAlt: "5215511111111@s.whatsapp.net",
      },
      "+52 55 1111 1111",
    ),
    true,
  );
});

test("does not confuse the managed business number with the personal owner", () => {
  assert.equal(
    isAuthorizedAddress(
      {
        remoteJid: "5215522222222@s.whatsapp.net",
        remoteJidAlt: "999999999999@lid",
      },
      "5215511111111",
    ),
    false,
  );
});

test("prefers a phone-number JID for stable conversation identity", () => {
  const address = {
    remoteJid: "123456789012345@lid",
    remoteJidAlt: "5215511111111@s.whatsapp.net",
  };
  assert.equal(
    preferredPhoneJid(address),
    "5215511111111@s.whatsapp.net",
  );
  assert.equal(
    exportablePhone(address.remoteJid, address.remoteJidAlt),
    "+5215511111111",
  );
});
