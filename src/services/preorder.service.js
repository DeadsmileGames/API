import crypto from "node:crypto";
import { randomInt } from "node:crypto";
import { pool, query } from "../config/database.js";
import { AppError } from "../utils/AppError.js";
import { sendTransactionalEmail } from "./brevo.service.js";
import { escapeHtml } from "../utils/html.js";

const LOCALES = new Set(["en","pt-BR","es"]);
const DEFAULT_AGE = { en: 13, "pt-BR": 13, es: 13 };
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const localeOf = (value) => LOCALES.has(value) ? value : "en";
const newCode = () => String(randomInt(0, 1_000_000)).padStart(6,"0");

export async function getPreorderInfo(slug, locale="en") {
 const { rows } = await query("SELECT id,slug,title,cover_image,preorder_starts_at,preorder_ends_at,preorder_age_ratings FROM games WHERE slug=$1 AND preorder_enabled=true",[slug]);
 const game=rows[0]; if(!game) throw new AppError(404,"PREORDER_NOT_FOUND");
 const now=Date.now();
 if(now<new Date(game.preorder_starts_at).getTime()||now>=new Date(game.preorder_ends_at).getTime()) throw new AppError(409,"PREORDER_NOT_OPEN");
 return {id:game.id,slug:game.slug,title:game.title,coverImage:game.cover_image,startsAt:game.preorder_starts_at,endsAt:game.preorder_ends_at,ageRatings:game.preorder_age_ratings||DEFAULT_AGE,locale:localeOf(locale)};
}

export async function createPreorder(slug,payload,requestLocale="en") {
 const locale=localeOf(payload.locale||requestLocale);
 const first=String(payload.firstName||"").trim(), last=String(payload.lastName||"").trim();
 const email=String(payload.email||"").trim().toLowerCase(), age=Number(payload.age);
 if(!first||first.length>100||!last||last.length>100||!Number.isInteger(age)||age<1||age>120||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400,"PREORDER_INVALID_FORM");
 const client=await pool.connect();
 try {
  await client.query("BEGIN");
  const found=await client.query("SELECT id,preorder_starts_at,preorder_ends_at,preorder_age_ratings FROM games WHERE slug=$1 AND preorder_enabled=true FOR SHARE",[slug]);
  const game=found.rows[0]; if(!game) throw new AppError(404,"PREORDER_NOT_FOUND");
  const now=Date.now(); if(now<new Date(game.preorder_starts_at).getTime()||now>=new Date(game.preorder_ends_at).getTime()) throw new AppError(409,"PREORDER_NOT_OPEN");
  const min=Number((game.preorder_age_ratings||DEFAULT_AGE)[locale]??DEFAULT_AGE[locale]);
  if(age<min) throw new AppError(403,"PREORDER_AGE_RESTRICTED");
  const result=await client.query("INSERT INTO game_preorders(game_id,first_name,last_name,age,locale,email) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(game_id,email) DO NOTHING RETURNING id",[game.id,first,last,age,locale,email]);
  if(!result.rows[0]) throw new AppError(409,"PREORDER_ALREADY_REGISTERED");
  await client.query("COMMIT"); return {registered:true};
 } catch(e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}

export async function redeemPreorderCode(code,account) {
 const normalized=String(code||"").replace(/\s/g,"");
 if(!/^\d{6}$/.test(normalized)) throw new AppError(404,"PREORDER_CODE_INVALID");
 const client=await pool.connect();
 try {
  await client.query("BEGIN");
  const found=await client.query("SELECT p.id,p.email,p.redeemed_at,g.slug FROM game_preorders p JOIN games g ON g.id=p.game_id WHERE p.code_hash=$1 FOR UPDATE",[hash(normalized)]);
  const p=found.rows[0];
  if(!p||p.redeemed_at||p.email!==String(account.email||"").trim().toLowerCase()) throw new AppError(404,"PREORDER_CODE_INVALID");
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

export async function sendPreorderEmailBatch() {
 const client=await pool.connect(); let batch=[];
 try {
  await client.query("BEGIN");
  const gate=await client.query("UPDATE preorder_email_batches SET last_batch_at=now() WHERE id=true AND (last_batch_at IS NULL OR last_batch_at<now()-interval '1 day') RETURNING id");
  if(!gate.rows.length){await client.query("ROLLBACK");return {sent:0};}
  const result=await client.query(`SELECT p.id,p.email,p.first_name,p.locale,p.game_id,g.title FROM game_preorders p JOIN games g ON g.id=p.game_id
  WHERE p.email_status IN ('waiting','failed') AND g.preorder_enabled=true AND g.preorder_ends_at<=now() AND g.preorder_reward_zip IS NOT NULL
  ORDER BY p.created_at LIMIT 100 FOR UPDATE OF p SKIP LOCKED`);
  batch=result.rows; await client.query("COMMIT");
 } catch(e){await client.query("ROLLBACK");throw e;} finally{client.release();}
 let sent=0;
 for(const p of batch){
  let code=null;
  try {
   for(let i=0;i<10;i++){const candidate=newCode();const exists=await query("SELECT 1 FROM game_preorders WHERE code_hash=$1",[hash(candidate)]);if(!exists.rows.length){code=candidate;break;}}
   if(!code) throw new AppError(503,"PREORDER_CODE_GENERATION_FAILED");
   await query("UPDATE game_preorders SET code_hash=$2 WHERE id=$1",[p.id,hash(code)]);
   const name=escapeHtml(p.first_name), title=escapeHtml(p.title);
   const copy=p.locale==="pt-BR"?{subject:"Sua recompensa de pré-venda: "+p.title,text:"Olá "+p.first_name+", a pré-venda terminou. Seu código único de resgate é "+code+". Entre na conta Deadsmile Games e selecione Resgatar código."}:p.locale==="es"?{subject:"Tu recompensa de reserva: "+p.title,text:"Hola "+p.first_name+", la reserva terminó. Tu código único es "+code+". Inicia sesión en Deadsmile Games y elige Canjear código."}:{subject:"Your preorder reward: "+p.title,text:"Hi "+p.first_name+", the preorder has ended. Your unique redemption code is "+code+". Sign in to Deadsmile Games and choose Redeem code."};
   await sendTransactionalEmail({to:p.email,subject:copy.subject,text:copy.text,html:`<p>${name}, ${title}</p><p><strong>${code}</strong></p><p>Deadsmile Games</p>`});
   await query("UPDATE game_preorders SET email_status='sent',code_sent_at=now() WHERE id=$1",[p.id]);sent++;
  } catch {
   await query("UPDATE game_preorders SET email_status='failed',code_hash=NULL WHERE id=$1",[p.id]).catch(()=>{});
  }
 }
 return {sent};
}
