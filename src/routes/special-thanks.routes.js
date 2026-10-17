import { Router } from "express";
import * as controller from "../controllers/special-thanks.controller.js";

export const specialThanksRouter = Router();

specialThanksRouter.get("/", controller.list);
