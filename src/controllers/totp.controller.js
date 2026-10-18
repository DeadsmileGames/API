import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as totpService from "../services/totp.service.js";
import { getAccount } from "../services/account.service.js";

export const status = asyncHandler(async (req, res) => {
  const result = await totpService.getTotpStatus(req.auth.userId);
  sendSuccess(res, result);
});

export const setup = asyncHandler(async (req, res) => {
  const user = await getAccount(req.auth.userId);
  const result = await totpService.generateTotpSetup(user.id, user.email);
  sendSuccess(res, result);
});

export const enable = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const result = await totpService.verifyAndEnableTotp(req.auth.userId, token);
  sendSuccess(res, result);
});

export const disable = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const result = await totpService.disableTotp(req.auth.userId, token);
  sendSuccess(res, result);
});
