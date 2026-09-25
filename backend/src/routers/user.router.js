import { Router } from "express";
import { SignupUser,LoginUser, RefreshToken } from "../controllers/user.controller";

export const userRouter = Router();


userRouter.post("/signup",SignupUser);
userRouter.post("login",LoginUser);
userRouter.post("/refresh",RefreshToken)