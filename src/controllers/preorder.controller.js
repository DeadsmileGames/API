import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";
import { query } from "../config/database.js";
import * as service from "../services/preorder.service.js";
export const info=asyncHandler(async(req,res)=>sendSuccess(res,await service.getPreorderInfo(req.params.slug,res.locals.locale)));
export const register=asyncHandler(async(req,res)=>sendSuccess(res,await service.createPreorder(req.params.slug,req.body,res.locals.locale,req.auth.userId),202));
export const status=asyncHandler(async(req,res)=>{res.set("Cache-Control","private, no-store");sendSuccess(res,await service.getPreorderStatus(req.params.slug,req.auth.userId));});
export const cancel=asyncHandler(async(req,res)=>sendSuccess(res,await service.cancelPreorder(req.params.slug,req.auth.userId)));
export const confirm=asyncHandler(async(req,res)=>sendSuccess(res,await service.confirmPreorder(req.params.token)));
export const ownerReward=asyncHandler(async(req,res)=>{res.set("Cache-Control","private, no-store");sendSuccess(res,await service.getOwnedPreorderReward(req.params.slug,req.auth.userId));});
export const ownerDownload=asyncHandler(async(req,res)=>{
 const zip=await service.downloadOwnedPreorderReward(req.params.slug,req.auth.userId);
 res.set("Content-Type","application/zip");
 res.set("Content-Disposition",'attachment; filename="deadsmile-preorder-reward.zip"');
 res.set("Cache-Control","private, no-store");
 res.send(zip);
});
export const redeem=asyncHandler(async(req,res)=>{
 const userId=req.auth?.userId;
 if(!userId) throw new AppError(401,"UNAUTHENTICATED");
 const {rows}=await query("SELECT id,email FROM users WHERE id=$1",[userId]);
 if(!rows[0]) throw new AppError(401,"UNAUTHENTICATED");
 sendSuccess(res,await service.redeemPreorderCode(req.body.code,rows[0]));
});
export const reward=asyncHandler(async(req,res)=>{res.set("Cache-Control","private, no-store");sendSuccess(res,await service.consumePreorderReward(req.params.token,req.auth.userId));});
export const download=asyncHandler(async(req,res)=>{
 const zip=await service.downloadPreorderReward(req.params.token,String(req.query.key||""),req.auth.userId);
 res.set("Content-Type","application/zip");
 res.set("Content-Disposition",'attachment; filename="deadsmile-preorder-reward.zip"');
 res.set("Cache-Control","no-store");res.send(zip);
});
