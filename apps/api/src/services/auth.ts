import type { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from "fastify";
import bcrypt from "bcryptjs";
import type { MeetingRecord, MeetingPermissions, PublicUser, User } from "@meeting-flow/shared";
import { findUserByEmail, findUserById, createUser as createUserInStore } from "../userStore.js";

const SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = "7d";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; email: string; role: string };
    user: PublicUser;
  }
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(app: FastifyInstance, user: PublicUser) {
  return app.jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export async function registerUser(
  app: FastifyInstance,
  email: string,
  password: string,
  name: string
) {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await findUserByEmail(normalizedEmail);

  if (existing) {
    throw new Error("该邮箱已被注册");
  }

  const passwordHash = await hashPassword(password);
  const user = await createUserInStore(normalizedEmail, name, passwordHash, "editor");
  const publicUser = toPublicUser(user);
  const token = signToken(app, publicUser);

  return { user: publicUser, token };
}

export async function loginUser(app: FastifyInstance, email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    throw new Error("邮箱或密码错误");
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error("邮箱或密码错误");
  }

  const publicUser = toPublicUser(user);
  const token = signToken(app, publicUser);

  return { user: publicUser, token };
}

export function buildPermissions(user: PublicUser, meeting?: MeetingRecord): MeetingPermissions {
  if (user.role === "admin") {
    return {
      canCreate: true,
      canEdit: true,
      canCancel: true,
      canDelete: true,
      canViewMinutes: true
    };
  }

  if (user.role === "viewer") {
    return {
      canCreate: false,
      canEdit: false,
      canCancel: false,
      canDelete: false,
      canViewMinutes: true
    };
  }

  const isOwner = meeting ? meeting.ownerUserId === user.id : false;

  return {
    canCreate: true,
    canEdit: isOwner,
    canCancel: isOwner,
    canDelete: isOwner,
    canViewMinutes: true
  };
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export function createAuthPreHandler(): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify<{ sub: string; email: string; role: string }>();
      const user = await findUserById(decoded.sub);

      if (!user) {
        return reply.code(401).send({ message: "认证已失效，请重新登录" });
      }

      request.user = toPublicUser(user);
    } catch {
      return reply.code(401).send({ message: "请先登录" });
    }
  };
}
