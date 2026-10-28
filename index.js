// Cloud Functions do Capital-X: código de 6 caracteres enviado por e-mail.
// O código nunca fica guardado em texto: só o hash, com validade e limite de tentativas.
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const SMTP_URL = defineSecret("SMTP_URL");      // ex.: smtps://usuario:senha@smtp.seuprovedor.com:465
const MAIL_FROM = defineString("MAIL_FROM");    // ex.: Capital-X <no-reply@seudominio.com>

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const VALIDADE_MS = 10 * 60 * 1000;
const REENVIO_MS = 60 * 1000;
const MAX_TENTATIVAS = 5;

const hash = (uid, codigo) =>
  crypto.createHash("sha256").update(`${uid}:${codigo}`).digest("hex");

// 6 caracteres, sempre com pelo menos uma letra e um número
function gerarCodigo() {
  let codigo;
  do {
    codigo = Array.from({ length: 6 }, () => ALFABETO[crypto.randomInt(ALFABETO.length)]).join("");
  } while (!/[A-Z]/.test(codigo) || !/[0-9]/.test(codigo));
  return codigo;
}

exports.enviarCodigo = onCall({ region: "us-central1", secrets: [SMTP_URL] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = request.auth.uid;

  const usuario = await getAuth().getUser(uid);
  if (!usuario.email) throw new HttpsError("failed-precondition", "This account has no email.");
  if (usuario.customClaims?.codigoVerificado) return { jaVerificado: true };

  const ref = getFirestore().collection("codigos").doc(uid);
  const atual = await ref.get();
  if (atual.exists && Date.now() - atual.data().criadoEm < REENVIO_MS) {
    throw new HttpsError("resource-exhausted", "Please wait a minute before requesting a new code.");
  }

  const codigo = gerarCodigo();
  await ref.set({
    hash: hash(uid, codigo),
    criadoEm: Date.now(),
    expiraEm: Date.now() + VALIDADE_MS,
    tentativas: 0
  });

  const transporte = nodemailer.createTransport(SMTP_URL.value());
  await transporte.sendMail({
    from: MAIL_FROM.value(),
    to: usuario.email,
    subject: "Your Capital-X verification code",
    text: `Your Capital-X verification code is ${codigo}\n\nIt expires in 10 minutes. If you did not request it, ignore this email.`,
    html: `<p>Your Capital-X verification code is:</p>
<p style="font-family:Georgia,serif;font-size:32px;letter-spacing:8px;margin:16px 0"><strong>${codigo}</strong></p>
<p>It expires in 10 minutes. If you did not request it, ignore this email.</p>`
  });

  return { enviado: true };
});

exports.verificarCodigo = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = request.auth.uid;

  const codigo = String(request.data?.codigo ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(codigo)) {
    throw new HttpsError("invalid-argument", "Enter the 6-character code from your email.");
  }

  const ref = getFirestore().collection("codigos").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("failed-precondition", "No active code. Request a new one.");
  }
  const dados = snap.data();

  if (Date.now() > dados.expiraEm) {
    await ref.delete();
    throw new HttpsError("deadline-exceeded", "This code expired. Request a new one.");
  }
  if (dados.tentativas >= MAX_TENTATIVAS) {
    throw new HttpsError("resource-exhausted", "Too many attempts. Request a new code.");
  }

  const certo =
    crypto.timingSafeEqual(Buffer.from(hash(uid, codigo)), Buffer.from(dados.hash));
  if (!certo) {
    await ref.update({ tentativas: FieldValue.increment(1) });
    throw new HttpsError("invalid-argument", "Incorrect code.");
  }

  const usuario = await getAuth().getUser(uid);
  await getAuth().setCustomUserClaims(uid, { ...(usuario.customClaims || {}), codigoVerificado: true });
  await getAuth().updateUser(uid, { emailVerified: true });
  await ref.delete();

  return { verificado: true };
});
