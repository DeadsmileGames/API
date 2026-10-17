import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";
import { query } from "../config/database.js";
import * as service from "../services/preorder.service.js";
export const info=asyncHandler(async(req,res)=>sendSuccess(res,await service.getPreorderInfo(req.params.slug,res.locals.locale)));
export const register=asyncHandler(async(req,res)=>sendSuccess(res,await service.createPreorder(req.params.slug,req.body,res.locals.locale),202));
export const confirm=asyncHandler(async(req,res)=>sendSuccess(res,await service.confirmPreorder(req.params.token)));
export const redeem=asyncHandler(async(req,res)=>{
 if(!req.session?.userId) throw new AppError(401,"UNAUTHENTICATED");
 const {rows}=await query("SELECT email FROM users WHERE id=$1",[req.session.userId]);
 if(!rows[0]) throw new AppError(401,"UNAUTHENTICATED");
 sendSuccess(res,await service.redeemPreorderCode(req.body.code,rows[0]));
});
export const reward=asyncHandler(async(req,res)=>sendSuccess(res,await service.consumePreorderReward(req.params.token)));
export const download=asyncHandler(async(req,res)=>{
 const zip=await service.downloadPreorderReward(req.params.token,String(req.query.key||""));
 res.set("Content-Type","application/zip");
 res.set("Content-Disposition",'attachment; filename="deadsmile-preorder-reward.zip"');
 res.set("Cache-Control","no-store");res.send(zip);
});
