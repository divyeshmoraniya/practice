import jwt from "jsonwebtoken";
import prisma from "../db/db.js";

export const authCheck = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ msg: "Access token missing or invalid format" });
    }

    const token = authHeader.split(" ")[1];

    // 2. Synchronous verification against ACCESS_TOKEN_SECRET
    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET || "fallback_access_key"
    );

    // 3. Attach user info to request (excluding password)
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(401).json({ msg: "User no longer exists" });
    }

    req.user = user;

    // 4. Pass execution to the controller
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      // Frontend Axios interceptor catches 401 and calls /refresh
      return res.status(401).json({ msg: "Access token expired" });
    }
    return res.status(403).json({ msg: "Invalid token" });
  }
};