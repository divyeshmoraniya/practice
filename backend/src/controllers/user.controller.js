import prisma from '../db/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';

const generateTokens = (userId) => {
    const accessToken = jwt.sign(
        { id: userId },
        process.env.ACCESS_TOKEN_SECRET || 'fallback_access_key',
        { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
        { id: userId },
        process.env.REFRESH_TOKEN_SECRET || 'fallback_refresh_key',
        { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
};

export const SignupUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ msg: "field not found" })
        }

        const existingUser = await prisma.user.findUnique({
            where: { email }
        })

        if (existingUser) {
            return res.status(409).json({ message: 'Email already registered' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword
            }
        })
        if (!user) {
            return res.status(402).json({ msg: "user not created" })
        }

        return res.status(200).json({ msg: "user signup" });
    } catch (error) {
        console.log(error)
    }
}

export const LoginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    // 1. Find user by email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!existingUser) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 2. Verify password
    const passchecker = await bcrypt.compare(password, existingUser.password);
    if (!passchecker) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 3. Generate tokens
    const { accessToken, refreshToken } = generateTokens(existingUser.id);

    // 4. Send Refresh Token in secure HttpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, // Javascript cannot read this (prevents XSS)
      secure: process.env.NODE_ENV === "production", // HTTPS only in prod
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // 5. Store refreshToken in DB (for revocation / rotation)
    await prisma.user.update({
      where: { email },
      data: { refreshToken },
    });

    // 6. Strip password & sensitive fields without extra DB query
    const { password: _, refreshToken: __, ...userSafe } = existingUser;

    // 7. Send accessToken in JSON body so Zustand can store it in memory
    return res.status(200).json({
      msg: "user logged in",
      user: userSafe,
      accessToken, // <-- Zustand receives this!
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const RefreshToken = async (req, res) => {
  try {
    const incomingRefreshToken = req.cookies?.refreshToken;

    if (!incomingRefreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    // 2. Verify signature & expiration
    let decoded;
    try {
      decoded = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET || "fallback_refresh_key"
      );
    } catch (err) {
      // Token is either expired or tampered with
      return res.status(403).json({ message: "Invalid or expired refresh token" });
    }

    // 3. Find user in PostgreSQL
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.refreshToken !== incomingRefreshToken) {
      // Possible compromise: clear cookie and block access
      res.clearCookie("refreshToken");
      return res.status(403).json({ message: "Refresh token revoked or reused" });
    }
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id);

    // 6. Update PostgreSQL with the new refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    // 7. Overwrite the old cookie with the new rotated refresh token
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // 8. Return the new accessToken to be stored in Zustand memory
    return res.status(200).json({
      accessToken,
    });
  } catch (error) {
    console.error("Refresh error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};