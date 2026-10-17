import crypto from "node:crypto";
import { randomInt } from "node:crypto";
import { pool, query } from "../config/database.js";
import { AppError } from "../utils/AppError.js";
import { sendTransactionalEmail } from "./brevo.service.js";
import { brandedEmail } from "./email-template.js";
import { env } from "../config/env.js";

const LOCALES = new Set(["en","pt-BR","es"]);
const DEFAULT_AGE = { en: 13, "pt-BR": 13, es: 13 };
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const localeOf = (value) => LOCALES.has(value) ? value : "en";
const newCode = () => String(randomInt(0, 1_000_000)).padStart(6,"0");

async function sendPreorderConfirmationEmail({ email, firstName, gameTitle, slug, token, locale }) {
 const confirmUrl = `${env.frontendUrl}/games/${encodeURIComponent(slug)}/preorder/confirm/${token}`;
 const copy = locale === "pt-BR"
  ? {
      subject: `Confirme sua pré-venda: ${gameTitle}`,
      preheader: "Confirme seu e-mail para concluir sua inscrição na pré-venda.",
      heading: "Confirme sua inscrição",
      intro: `Olá ${firstName}! Recebemos um pedido para inscrever você na pré-venda de ${gameTitle}.`,
      action: "Confirmar pré-venda",
      text: `Olá ${firstName}, recebemos um pedido de inscrição na pré-venda de ${gameTitle}. Confirme sua participação usando este link: ${confirmUrl}\n\nO link expira em 24 horas. Se você não fez esse pedido, ignore este e-mail.`,
      expiry: "Este link expira em 24 horas. Sua inscrição só será confirmada depois que você clicar no botão.",
      footer: "Se você não solicitou esta inscrição, pode ignorar esta mensagem."
    }
  : locale === "es"
   ? {
      subject: `Confirma tu reserva: ${gameTitle}`,
      preheader: "Confirma tu correo para completar la reserva del juego.",
      heading: "Confirma tu inscripción",
      intro: `¡Hola ${firstName}! Recibimos una solicitud para inscribirte en la reserva de ${gameTitle}.`,
      action: "Confirmar reserva",
      text: `Hola ${firstName}, recibimos una solicitud para la reserva de ${gameTitle}. Confirma tu participación con este enlace: ${confirmUrl}\n\nEl enlace caduca en 24 horas. Si no hiciste esta solicitud, ignora este correo.`,
      expiry: "Este enlace caduca en 24 horas. Tu inscripción solo se confirma al hacer clic en el botón.",
      footer: "Si no solicitaste esta inscripción, puedes ignorar este mensaje."
    }
   : {
      subject: `Confirm your pre-order: ${gameTitle}`,
      preheader: "Confirm your email to finish joining this game's pre-order.",
      heading: "Confirm your pre-order",
      intro: `Hi ${firstName}! We received a request to join the pre-order for ${gameTitle}.`,
      action: "Confirm pre-order",
      text: `Hi ${firstName}, we received a request to join the pre-order for ${gameTitle}. Confirm your spot with this link: ${confirmUrl}\n\nThe link expires in 24 hours. If you did not make this request, ignore this email.`,
      expiry: "This link expires in 24 hours. Your registration is complete only after you click the button.",
      footer: "If you did not request this registration, you can ignore this message."
    };
 const html = brandedEmail({
  heading: copy.heading,
  intro: `${copy.intro} ${copy.expiry}`,
  actionLabel: copy.action,
  actionUrl: confirmUrl,
  footer: copy.footer
 });
 await sendTransactionalEmail({ to: email, subject: copy.subject, text: copy.text, html });
}

export async function getPreorderInfo(slug, locale="en") {
 const { rows } = await query("SELECT id,slug,title,cover_image,preorder_starts_at,preorder_ends_at FROM games WHERE slug=$1 AND preorder_enabled=true AND access_type='free'",[slug]);
 const game=rows[0]; if(!game) throw new AppError(404,"PREORDER_NOT_FOUND");
 const now=Date.now();
 if(now<new Date(game.preorder_starts_at).getTime()||now>=new Date(game.preorder_ends_at).getTime()) throw new AppError(409,"PREORDER_NOT_OPEN");
 return {id:game.id,slug:game.slug,title:game.title,coverImage:game.cover_image,startsAt:game.preorder_starts_at,endsAt:game.preorder_ends_at,locale:localeOf(locale)};
}

export async function getPreorderStatus(slug, userId) {
 if (!userId) throw new AppError(401, "UNAUTHENTICATED");
 const gameResult = await query("SELECT id,slug,title,cover_image,preorder_starts_at,preorder_ends_at,preorder_enabled,access_type FROM games WHERE slug=$1", [slug]);
 const game = gameResult.rows[0];
 if (!game) throw new AppError(404, "PREORDER_NOT_FOUND");
 const { rows: preorderRows } = await query(
  "SELECT p.id,p.confirmed_at,p.confirmation_expires_at,p.created_at,p.reward_code FROM game_preorders p JOIN users account ON account.id=$2 WHERE p.game_id=$1 AND (p.user_id=$2 OR (p.user_id IS NULL AND lower(p.email)=lower(account.email))) ORDER BY p.created_at DESC LIMIT 1",
  [game.id, userId],
 );
 const preorder = preorderRows[0] || null;
 const { rows: limitRows } = await query(
  "SELECT attempts FROM game_preorder_daily_limits WHERE user_id=$1 AND game_id=$2 AND activity_date=(now() AT TIME ZONE 'America/Sao_Paulo')::date",
  [userId, game.id],
 );
 const attemptsUsed = Number(limitRows[0]?.attempts || 0);
 const now = Date.now();
 const preorderStatus = !preorder ? null : preorder.confirmed_at ? "confirmed" : preorder.confirmation_expires_at && new Date(preorder.confirmation_expires_at).getTime() <= now ? "expired" : "pending";
 return {
  game: { id: game.id, slug: game.slug, title: game.title, coverImage: game.cover_image, startsAt: game.preorder_starts_at, endsAt: game.preorder_ends_at, preorderEnabled: game.preorder_enabled, isFree: game.access_type === "free" },
  preorderStatus,
  hasPreorderRecord: Boolean(preorder),
  attemptsUsed,
  attemptsRemaining: Math.max(0, 2 - attemptsUsed),
  rewardCode: preorder?.confirmed_at ? preorder.reward_code || null : null,
  rewardRedeemable: Boolean(preorder?.confirmed_at && game.preorder_ends_at && Date.now() >= new Date(game.preorder_ends_at).getTime()),
 };
}

export async function createPreorder(slug, payload, requestLocale = "en", userId) {
 if (!userId) throw new AppError(401, "UNAUTHENTICATED");
 const locale = localeOf(payload.locale || requestLocale);
 const first = String(payload.firstName || "").trim();
 const last = String(payload.lastName || "").trim();
 const email = String(payload.email || "").trim().toLowerCase();
 const age = Number(payload.age);
 if (!first || first.length > 100 || !last || last.length > 100 || !Number.isInteger(age) || age < 1 || age > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new AppError(400, "PREORDER_INVALID_FORM");
 }
 const rawToken = crypto.randomBytes(32).toString("base64url");
 const tokenHash = hash(rawToken);
 const client = await pool.connect();
 let registrationId;
 let game;
 let attemptsUsed = 0;
 try {
  await client.query("BEGIN");
  const found = await client.query("SELECT id,slug,title,preorder_starts_at,preorder_ends_at,preorder_age_ratings,access_type FROM games WHERE slug=$1 AND preorder_enabled=true AND access_type='free' FOR SHARE", [slug]);
  game = found.rows[0];
  if (!game) throw new AppError(404, "PREORDER_NOT_FOUND");
  const now = Date.now();
  if (now < new Date(game.preorder_starts_at).getTime() || now >= new Date(game.preorder_ends_at).getTime()) throw new AppError(409, "PREORDER_NOT_OPEN");
  const min = Number((game.preorder_age_ratings || DEFAULT_AGE)[locale] ?? DEFAULT_AGE[locale]);
  if (age < min) throw new AppError(403, "PREORDER_AGE_RESTRICTED");

  const current = await client.query(
   "SELECT p.id,p.confirmed_at,p.confirmation_expires_at,p.user_id FROM game_preorders p LEFT JOIN users account ON account.id=$2 WHERE p.game_id=$1 AND (p.user_id=$2 OR (p.user_id IS NULL AND account.id IS NOT NULL AND lower(p.email)=lower(account.email))) FOR UPDATE OF p",
   [game.id, userId],
  );
  const existing = current.rows[0] || null;
  if (existing?.confirmed_at) throw new AppError(409, "PREORDER_ALREADY_REGISTERED");
  if (existing?.confirmation_expires_at && new Date(existing.confirmation_expires_at).getTime() > now) throw new AppError(409, "PREORDER_AWAITING_CONFIRMATION");

  const emailOwner = await client.query(
   "SELECT id,user_id FROM game_preorders WHERE game_id=$1 AND lower(email)=lower($2) FOR UPDATE",
   [game.id, email],
  );
  if (emailOwner.rows[0] && String(emailOwner.rows[0].id) !== String(existing?.id || "")) throw new AppError(409, "PREORDER_EMAIL_IN_USE");

  const quota = await client.query(
   "INSERT INTO game_preorder_daily_limits(user_id,game_id,activity_date,attempts,updated_at) VALUES($1,$2,(now() AT TIME ZONE 'America/Sao_Paulo')::date,1,now()) ON CONFLICT(user_id,game_id,activity_date) DO UPDATE SET attempts=game_preorder_daily_limits.attempts+1,updated_at=now() WHERE game_preorder_daily_limits.attempts<2 RETURNING attempts",
   [userId, game.id],
  );
  if (!quota.rows.length) throw new AppError(429, "PREORDER_DAILY_LIMIT");
  attemptsUsed = Number(quota.rows[0].attempts);
  await client.query("DELETE FROM game_preorder_daily_limits WHERE activity_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date - 7");

  if (existing) {
   registrationId = existing.id;
   await client.query(
    "UPDATE game_preorders SET user_id=$2,first_name=$3,last_name=$4,age=$5,locale=$6,email=$7,code_hash=NULL,reward_code=NULL,claim_token_hash=NULL,claim_token_expires_at=NULL,reward_accessed_at=NULL,reward_download_token_hash=NULL,redeemed_at=NULL,confirmation_token_hash=$8,confirmation_expires_at=now()+interval '24 hours',confirmed_at=NULL,created_at=now() WHERE id=$1",
    [registrationId, userId, first, last, age, locale, email, tokenHash],
   );
  } else {
   const inserted = await client.query(
    "INSERT INTO game_preorders(game_id,user_id,first_name,last_name,age,locale,email,confirmation_token_hash,confirmation_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '24 hours') RETURNING id",
    [game.id, userId, first, last, age, locale, email, tokenHash],
   );
   registrationId = inserted.rows[0].id;
  }
  await client.query("COMMIT");
 } catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  if (error?.code === "23505") throw new AppError(409, "PREORDER_EMAIL_IN_USE");
  throw error;
 } finally {
  client.release();
 }
 await sendPreorderConfirmationEmail({ email, firstName: first, gameTitle: game.title, slug: game.slug, token: rawToken, locale });
 return { confirmationSent: true, attemptsRemaining: Math.max(0, 2 - attemptsUsed) };
}

export async function cancelPreorder(slug, userId) {
 if (!userId) throw new AppError(401, "UNAUTHENTICATED");
 const gameResult = await query("SELECT id FROM games WHERE slug=$1", [slug]);
 const game = gameResult.rows[0];
 if (!game) throw new AppError(404, "PREORDER_NOT_FOUND");
 const { rows } = await query(
  "DELETE FROM game_preorders p USING users account WHERE p.game_id=$1 AND account.id=$2 AND (p.user_id=$2 OR (p.user_id IS NULL AND lower(p.email)=lower(account.email))) RETURNING p.id",
  [game.id, userId],
 );
 if (!rows.length) throw new AppError(404, "PREORDER_NOT_FOUND");
 const { rows: limitRows } = await query(
  "SELECT attempts FROM game_preorder_daily_limits WHERE user_id=$1 AND game_id=$2 AND activity_date=(now() AT TIME ZONE 'America/Sao_Paulo')::date",
  [userId, game.id],
 );
 const attemptsUsed = Number(limitRows[0]?.attempts || 0);
 return { cancelled: true, attemptsUsed, attemptsRemaining: Math.max(0, 2 - attemptsUsed) };
}

export async function confirmPreorder(token) {
 if (typeof token !== "string" || token.length < 32 || token.length > 128) {
  throw new AppError(410, "PREORDER_CONFIRMATION_INVALID");
 }
 const tokenHash = hash(token);
 const pending = await query(
  `SELECT p.id, g.slug
   FROM game_preorders p JOIN games g ON g.id = p.game_id
   WHERE p.confirmation_token_hash = $1
     AND p.confirmation_expires_at > now()
     AND p.confirmed_at IS NULL`,
  [tokenHash],
 );
 const preorder = pending.rows[0];
 if (!preorder) throw new AppError(410, "PREORDER_CONFIRMATION_INVALID");

 // Allocate the displayable six-digit code as part of confirming the registration.
 // The digest remains the value used for redemption; the raw value is only returned
 // to the authenticated owner through the preorder status endpoint.
 for (let attempt = 0; attempt < 20; attempt += 1) {
  const code = newCode();
  try {
   const updated = await query(
    `UPDATE game_preorders
     SET confirmed_at = now(),
         confirmation_token_hash = NULL,
         confirmation_expires_at = NULL,
         code_hash = $2,
         reward_code = $3
     WHERE id = $1
       AND confirmation_token_hash = $4
       AND confirmation_expires_at > now()
       AND confirmed_at IS NULL
     RETURNING id`,
    [preorder.id, hash(code), code, tokenHash],
   );
   if (!updated.rows[0]) throw new AppError(410, "PREORDER_CONFIRMATION_INVALID");
   return { confirmed: true, slug: preorder.slug };
  } catch (error) {
   if (error?.code === "23505") continue;
   throw error;
  }
 }
 throw new AppError(503, "PREORDER_CODE_GENERATION_FAILED");
}

export async function redeemPreorderCode(code,account) {
 const normalized=String(code||"").replace(/\s/g,"");
 if(!/^\d{6}$/.test(normalized)) throw new AppError(404,"PREORDER_CODE_INVALID");
 const client=await pool.connect();
 try {
  await client.query("BEGIN");
  const found=await client.query("SELECT p.id,p.user_id,p.email,p.redeemed_at,p.confirmed_at,g.slug FROM game_preorders p JOIN games g ON g.id=p.game_id WHERE p.code_hash=$1 AND p.confirmed_at IS NOT NULL AND g.preorder_ends_at <= now() FOR UPDATE",[hash(normalized)]);
  const p=found.rows[0];
  if(!p||p.redeemed_at||(p.user_id?String(p.user_id)!==String(account.id||""):p.email!==String(account.email||"").trim().toLowerCase())) throw new AppError(404,"PREORDER_CODE_INVALID");
  const token=crypto.randomBytes(32).toString("base64url");
  await client.query("UPDATE game_preorders SET redeemed_at=now(),claim_token_hash=$2,claim_token_expires_at=now()+interval '15 minutes' WHERE id=$1",[p.id,hash(token)]);
  await client.query("COMMIT");
  return {rewardUrl:"/games/"+encodeURIComponent(p.slug)+"/preorder/reward/"+token};
 } catch(e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}

export async function consumePreorderReward(token) {
 if(typeof token!=="string"||token.length<32||token.length>128) throw new AppError(404,"PREORDER_REWARD_NOT_FOUND");
 const downloadKey=crypto.randomBytes(32).toString("base64url");
 const {rows}=await query(`UPDATE game_preorders p SET reward_accessed_at=now(),reward_download_token_hash=$2
 FROM games g WHERE p.game_id=g.id AND p.claim_token_hash=$1 AND p.redeemed_at IS NOT NULL
 AND p.reward_accessed_at IS NULL AND p.claim_token_expires_at>now()
 RETURNING p.id,g.slug,g.title,g.preorder_reward_type,g.preorder_reward_description,g.preorder_reward_wallpapers,(g.preorder_reward_zip IS NOT NULL) AS has_zip`,[hash(token),hash(downloadKey)]);
 const row=rows[0]; if(!row) throw new AppError(404,"PREORDER_REWARD_NOT_FOUND");
 return {id:row.id,slug:row.slug,title:row.title,rewardType:row.preorder_reward_type,description:row.preorder_reward_description||"",wallpapers:row.preorder_reward_wallpapers||[],downloadAvailable:row.has_zip,downloadUrl:row.has_zip?"/api/preorders/reward/"+token+"/download?key="+downloadKey:null};
}
export async function downloadPreorderReward(token,key) {
 if(typeof token!=="string"||typeof key!=="string"||token.length<32||key.length<32) throw new AppError(404,"PREORDER_REWARD_NOT_FOUND");
 const {rows}=await query(`UPDATE game_preorders p SET reward_download_token_hash=NULL FROM games g
 WHERE p.game_id=g.id AND p.claim_token_hash=$1 AND p.reward_download_token_hash=$2
 RETURNING g.preorder_reward_zip`,[hash(token),hash(key)]);
 if(!rows[0]?.preorder_reward_zip) throw new AppError(404,"PREORDER_REWARD_NOT_FOUND");
 return rows[0].preorder_reward_zip;
}

