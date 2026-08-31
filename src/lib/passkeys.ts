import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import db from "./db";
import { randomId } from "./crypto";
import { getSessionUser, createSession } from "./auth";

export const RP_ID = process.env.HRMATE_RP_ID || "dfoods.duckdns.org";
export const RP_NAME = "HRMate";
export const EXPECTED_ORIGIN = process.env.HRMATE_ORIGIN || "https://dfoods.duckdns.org";

export function getUserPasskeys(userId: string) {
  return db
    .prepare("SELECT id, credential_id, device_name, created_at FROM passkey_credentials WHERE user_id = ?")
    .all(userId);
}

export async function registrationOptions(userId: string) {
  const user = db.prepare("SELECT email, name FROM users WHERE id = ?").get(userId) as any;
  if (!user) throw new Error("User not found");

  const existing = db
    .prepare("SELECT credential_id FROM passkey_credentials WHERE user_id = ?")
    .all(userId) as { credential_id: string }[];

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(userId),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credential_id,
      type: "public-key",
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      authenticatorAttachment: "platform",
    },
  });

  return options;
}

export async function verifyRegistration(userId: string, body: RegistrationResponseJSON) {
  const challenge = db
    .prepare("SELECT value FROM settings WHERE key = 'passkey_challenge'")
    .get() as { value: string } | undefined;
  if (!challenge) throw new Error("No registration in progress");

  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge: challenge.value,
    expectedOrigin: EXPECTED_ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Passkey verification failed");
  }

  const { credential } = verification.registrationInfo;
  db.prepare(
    `INSERT INTO passkey_credentials (id, user_id, credential_id, public_key, counter, transports, device_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomId("pk_"),
    userId,
    credential.id,
    Buffer.from(credential.publicKey).toString("base64"),
    credential.counter,
    JSON.stringify(body.response.transports || []),
    "Passkey",
    Date.now()
  );

  db.prepare("DELETE FROM settings WHERE key = 'passkey_challenge'").run();
  return true;
}

export async function authenticationOptions() {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "preferred",
  });
  return options;
}

export async function verifyAuthentication(body: AuthenticationResponseJSON) {
  const challenge = db
    .prepare("SELECT value FROM settings WHERE key = 'passkey_challenge'")
    .get() as { value: string } | undefined;
  if (!challenge) throw new Error("No authentication in progress");

  const cred = db
    .prepare("SELECT * FROM passkey_credentials WHERE credential_id = ?")
    .get(body.id) as any;
  if (!cred) throw new Error("Passkey not registered");

  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge: challenge.value,
    expectedOrigin: EXPECTED_ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: cred.credential_id,
      publicKey: new Uint8Array(Buffer.from(cred.public_key, "base64")),
      counter: cred.counter,
      transports: cred.transports ? JSON.parse(cred.transports) : undefined,
    },
  });

  if (!verification.verified) throw new Error("Passkey verification failed");

  db.prepare("UPDATE passkey_credentials SET counter = ? WHERE id = ?").run(
    verification.authenticationInfo.newCounter,
    cred.id
  );
  db.prepare("DELETE FROM settings WHERE key = 'passkey_challenge'").run();

  const session = createSession(cred.user_id);
  return session;
}

export function storeChallenge(challenge: string) {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('passkey_challenge', ?)").run(
    challenge
  );
}

export function removePasskey(userId: string, passkeyId: string) {
  const current = getSessionUser();
  if (!current) throw new Error("Not authenticated");
  db.prepare("DELETE FROM passkey_credentials WHERE id = ? AND user_id = ?").run(
    passkeyId,
    userId
  );
}
