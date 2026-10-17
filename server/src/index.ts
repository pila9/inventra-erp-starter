import "dotenv/config";
import { createHash, pbkdf2 as pbkdf2Callback, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import cors from "cors";
import express, { type ErrorRequestHandler, type NextFunction, type Request, type Response } from "express";
import { Prisma, PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.PORT || process.env.API_PORT || 3001);
const maxDatabaseInteger = 2_147_483_647;
const pbkdf2 = promisify(pbkdf2Callback);
const sessionCookieName = "inventra_session";
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const passwordIterations = 310_000;
const passwordBytes = 32;

app.use(cors());
app.use(express.json({ limit: "32kb" }));

type ProductInput = {
  name: string;
  sku: string;
  category: string;
  incoming: number;
  stock: number;
  unitPrice: number;
  lowStockThreshold: number;
};

type ProductionOrderInput = {
  outputProductId: number;
  quantity: number;
  materials: { productId: number; quantityPerUnit: number }[];
};

type SalesOrderInput = {
  customer: string;
  email: string | null;
  notes: string | null;
  items: { productId: number; quantity: number }[];
};

type SupportTicketInput = {
  requester: string;
  email: string;
  subject: string;
  category: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  description: string;
};

type AppSettingsInput = {
  businessName: string;
  contactEmail: string;
  phone: string;
  address: string;
  defaultLowStockThreshold: number;
};

const supportCategories = ["GENERAL", "ACCOUNT", "INVENTORY", "PRODUCTION", "ORDERS", "TECHNICAL"] as const;
const supportPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
const supportStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const;

const accessModules = [
  "DASHBOARD",
  "INVENTORY",
  "PRODUCTION",
  "ORDERS",
  "REPORTS",
  "USER_ACCESS",
  "SUPPORT",
  "SETTINGS",
] as const;
type AccessModule = (typeof accessModules)[number];
type UserRole = "ADMIN" | "MANAGER" | "STAFF";
type UserStatus = "ACTIVE" | "INVITED" | "DISABLED";
type UserAccountInput = {
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  permissions: Record<AccessModule, boolean>;
  password: string | null;
};

const roleDefaults: Record<UserRole, Record<AccessModule, boolean>> = {
  ADMIN: {
    DASHBOARD: true,
    INVENTORY: true,
    PRODUCTION: true,
    ORDERS: true,
    REPORTS: true,
    USER_ACCESS: true,
    SUPPORT: true,
    SETTINGS: true,
  },
  MANAGER: {
    DASHBOARD: true,
    INVENTORY: true,
    PRODUCTION: true,
    ORDERS: true,
    REPORTS: true,
    USER_ACCESS: false,
    SUPPORT: true,
    SETTINGS: true,
  },
  STAFF: {
    DASHBOARD: true,
    INVENTORY: true,
    PRODUCTION: false,
    ORDERS: true,
    REPORTS: false,
    USER_ACCESS: false,
    SUPPORT: true,
    SETTINGS: false,
  },
};

function parseAppSettings(value: unknown): AppSettingsInput | string {
  if (!isRecord(value)) return "A settings object is required.";
  const { businessName, contactEmail, phone, address, defaultLowStockThreshold } = value;
  if (typeof businessName !== "string" || !businessName.trim()) return "Business name is required.";
  if (businessName.trim().length > 120) return "Business name must be 120 characters or fewer.";
  if (typeof contactEmail !== "string") return "Contact email must be text.";
  const normalizedEmail = contactEmail.trim().toLowerCase();
  if (normalizedEmail.length > 254 || (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))) {
    return "Enter a valid contact email address.";
  }
  if (typeof phone !== "string" || phone.trim().length > 40) return "Phone number must be 40 characters or fewer.";
  if (typeof address !== "string" || address.trim().length > 500) return "Address must be 500 characters or fewer.";
  if (!Number.isSafeInteger(defaultLowStockThreshold) || Number(defaultLowStockThreshold) < 0 || Number(defaultLowStockThreshold) > maxDatabaseInteger) {
    return "Default low-stock threshold must be a non-negative whole number.";
  }
  return {
    businessName: businessName.trim(),
    contactEmail: normalizedEmail,
    phone: phone.trim(),
    address: address.trim(),
    defaultLowStockThreshold: Number(defaultLowStockThreshold),
  };
}

function parseSupportTicket(value: unknown): SupportTicketInput | string {
  if (!isRecord(value)) return "A support ticket object is required.";
  const { requester, email, subject, category, priority, description } = value;
  if (typeof requester !== "string" || !requester.trim()) return "Your name is required.";
  if (requester.trim().length > 120) return "Your name must be 120 characters or fewer.";
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) {
    return "Enter a valid email address.";
  }
  if (typeof subject !== "string" || !subject.trim()) return "A subject is required.";
  if (subject.trim().length > 160) return "Subject must be 160 characters or fewer.";
  if (typeof category !== "string" || !supportCategories.includes(category as (typeof supportCategories)[number])) {
    return "Choose a valid support category.";
  }
  const normalizedPriority = priority ?? "NORMAL";
  if (typeof normalizedPriority !== "string" || !supportPriorities.includes(normalizedPriority as (typeof supportPriorities)[number])) {
    return "Choose a valid support priority.";
  }
  if (typeof description !== "string" || !description.trim()) return "Describe the issue.";
  if (description.trim().length > 4000) return "Description must be 4,000 characters or fewer.";
  return {
    requester: requester.trim(),
    email: email.trim().toLowerCase(),
    subject: subject.trim(),
    category,
    priority: normalizedPriority as SupportTicketInput["priority"],
    description: description.trim(),
  };
}

function parseSupportReply(value: unknown): { message: string } | string {
  if (!isRecord(value) || typeof value.message !== "string" || !value.message.trim()) {
    return "A reply message is required.";
  }
  if (value.message.trim().length > 2000) return "Reply must be 2,000 characters or fewer.";
  return { message: value.message.trim() };
}

class ProductionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function parseUserAccount(value: unknown, requirePassword = false): UserAccountInput | string {
  if (!isRecord(value)) return "A user account object is required.";
  const { fullName, email, role, status, password } = value;
  if (typeof fullName !== "string" || !fullName.trim()) return "Full name is required.";
  if (fullName.trim().length > 120) return "Full name must be 120 characters or fewer.";
  if (typeof email !== "string" || !email.trim()) return "Email address is required.";
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return "Enter a valid email address.";
  }
  if (role !== "ADMIN" && role !== "MANAGER" && role !== "STAFF") {
    return "Role must be Admin, Manager, or Staff.";
  }
  const normalizedStatus = status ?? "ACTIVE";
  if (normalizedStatus !== "ACTIVE" && normalizedStatus !== "INVITED" && normalizedStatus !== "DISABLED") {
    return "Status must be Active, Invited, or Disabled.";
  }
  if (requirePassword && typeof password !== "string") return "Set an initial password for this user.";
  if (password !== undefined && password !== "" && (typeof password !== "string" || password.length < 12 || password.length > 128)) {
    return "Password must be between 12 and 128 characters.";
  }

  const permissions = { ...roleDefaults[role] };
  if (value.permissions !== undefined) {
    if (!isRecord(value.permissions)) return "Module permissions must be an object.";
    for (const [module, canView] of Object.entries(value.permissions)) {
      if (!accessModules.includes(module as AccessModule)) {
        return `Unknown permission module: ${module}.`;
      }
      if (typeof canView !== "boolean") return `Permission for ${module} must be true or false.`;
      permissions[module as AccessModule] = canView;
    }
  }
  if (role !== "ADMIN" && permissions.USER_ACCESS) {
    return "Only administrator accounts can access User Access.";
  }
  return {
    fullName: fullName.trim(),
    email: cleanEmail,
    role,
    status: normalizedStatus,
    permissions,
    password: typeof password === "string" && password ? password : null,
  };
}

function parseSalesOrder(value: unknown): SalesOrderInput | string {
  if (!isRecord(value)) return "An order object is required.";
  const { customer, email, notes, items } = value;
  if (typeof customer !== "string" || !customer.trim()) return "Customer name is required.";
  if (customer.trim().length > 120) return "Customer name must be 120 characters or fewer.";
  if (email !== undefined && email !== null && typeof email !== "string") {
    return "Customer email must be text.";
  }
  const cleanEmail = typeof email === "string" ? email.trim() : "";
  if (cleanEmail.length > 254 || (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) {
    return "Enter a valid customer email address.";
  }
  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    return "Order notes must be text.";
  }
  const cleanNotes = typeof notes === "string" ? notes.trim() : "";
  if (cleanNotes.length > 500) return "Order notes must be 500 characters or fewer.";
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
    return "Add between 1 and 50 order items.";
  }
  const seen = new Set<number>();
  const parsedItems: SalesOrderInput["items"] = [];
  for (const item of items) {
    if (!isRecord(item)) return "Each order item must be an object.";
    const { productId, quantity } = item;
    if (!Number.isSafeInteger(productId) || Number(productId) < 1) {
      return "Each order item must reference a valid product.";
    }
    if (!Number.isSafeInteger(quantity) || Number(quantity) < 1 || Number(quantity) > maxDatabaseInteger) {
      return "Order item quantities must be positive whole numbers.";
    }
    if (seen.has(Number(productId))) return "A product may only appear once per order.";
    seen.add(Number(productId));
    parsedItems.push({ productId: Number(productId), quantity: Number(quantity) });
  }
  return {
    customer: customer.trim(),
    email: cleanEmail || null,
    notes: cleanNotes || null,
    items: parsedItems,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseProduct(value: unknown): ProductInput | string {
  if (!isRecord(value)) return "A product object is required.";
  const { name, sku, category, incoming, stock, unitPrice, lowStockThreshold } = value;
  if (typeof name !== "string" || !name.trim()) return "Product name is required.";
  if (typeof sku !== "string" || !sku.trim()) return "SKU is required.";
  if (typeof category !== "string" || !category.trim()) return "Category is required.";

  const numbers = {
    incoming: incoming ?? 0,
    stock: stock ?? 0,
    unitPrice,
    lowStockThreshold: lowStockThreshold ?? 5,
  };
  for (const [field, number] of Object.entries(numbers)) {
    if (typeof number !== "number" || !Number.isFinite(number) || number < 0) {
      return `${field} must be a non-negative number.`;
    }
    if (field !== "unitPrice" && !Number.isInteger(number)) {
      return `${field} must be a whole number.`;
    }
  }
  if (name.trim().length > 120) return "Product name must be 120 characters or fewer.";
  if (sku.trim().length > 40) return "SKU must be 40 characters or fewer.";
  if (category.trim().length > 80) return "Category must be 80 characters or fewer.";
  return {
    name: name.trim(),
    sku: sku.trim(),
    category: category.trim(),
    incoming: numbers.incoming as number,
    stock: numbers.stock as number,
    unitPrice: numbers.unitPrice as number,
    lowStockThreshold: numbers.lowStockThreshold as number,
  };
}

function parseProductionOrder(value: unknown): ProductionOrderInput | string {
  if (!isRecord(value)) return "A production order object is required.";
  const { outputProductId, quantity, materials } = value;
  if (!Number.isSafeInteger(outputProductId) || Number(outputProductId) < 1) {
    return "Choose a finished product.";
  }
  if (!Number.isSafeInteger(quantity) || Number(quantity) < 1 || Number(quantity) > maxDatabaseInteger) {
    return "Production quantity must be a positive whole number.";
  }
  if (!Array.isArray(materials) || materials.length < 1 || materials.length > 50) {
    return "Add between 1 and 50 raw materials.";
  }

  const seen = new Set<number>();
  const parsedMaterials: ProductionOrderInput["materials"] = [];
  for (const material of materials) {
    if (!isRecord(material)) return "Each material must be an object.";
    const { productId, quantityPerUnit } = material;
    if (!Number.isSafeInteger(productId) || Number(productId) < 1) {
      return "Each material must reference a valid product.";
    }
    if (!Number.isSafeInteger(quantityPerUnit) || Number(quantityPerUnit) < 1 || Number(quantityPerUnit) > maxDatabaseInteger) {
      return "Material quantity per unit must be a positive whole number.";
    }
    if (seen.has(Number(productId))) return "A raw material may only be added once.";
    seen.add(Number(productId));
    parsedMaterials.push({
      productId: Number(productId),
      quantityPerUnit: Number(quantityPerUnit),
    });
  }
  if (seen.has(Number(outputProductId))) {
    return "The finished product cannot also be a raw material.";
  }
  return {
    outputProductId: Number(outputProductId),
    quantity: Number(quantity),
    materials: parsedMaterials,
  };
}

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await pbkdf2(password, salt, passwordIterations, passwordBytes, "sha256");
  return `pbkdf2$${passwordIterations}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationsValue, saltValue, expectedValue] = encoded.split("$");
  const iterations = Number(iterationsValue);
  if (algorithm !== "pbkdf2" || !Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) {
    return false;
  }
  const salt = Buffer.from(saltValue || "", "base64url");
  const expected = Buffer.from(expectedValue || "", "base64url");
  if (salt.length !== 16 || expected.length !== passwordBytes) return false;
  const actual = await pbkdf2(password, salt, iterations, passwordBytes, "sha256");
  return timingSafeEqual(actual, expected);
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sessionTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.cookie || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${sessionCookieName}=([A-Za-z0-9_-]+)`));
  return match?.[1] || null;
}

function setSessionCookie(response: Response, token: string, expiresAt: Date) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  response.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`,
  );
}

function clearSessionCookie(response: Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
  );
}

const authUserDetails = { permissions: { orderBy: { module: "asc" as const } } };

async function createSession(userId: number, response: Response) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);
  await prisma.authSession.create({
    data: { tokenHash: tokenHash(token), userId, expiresAt },
  });
  setSessionCookie(response, token, expiresAt);
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const maxLoginAttempts = 10;
const loginWindowMs = 15 * 60 * 1000;

function checkLoginRateLimit(address: string): number {
  const now = Date.now();
  const attempt = loginAttempts.get(address);
  if (!attempt || attempt.resetAt <= now) {
    loginAttempts.set(address, { count: 1, resetAt: now + loginWindowMs });
    return 0;
  }
  if (attempt.count >= maxLoginAttempts) return Math.ceil((attempt.resetAt - now) / 1000);
  attempt.count += 1;
  return 0;
}

function resetLoginRateLimit(address: string) {
  loginAttempts.delete(address);
}

function requireAuthentication(request: Request, response: Response, next: NextFunction) {
  void (async () => {
    const token = sessionTokenFromRequest(request);
    if (!token) {
      response.status(401).json({ error: "Sign in to continue." });
      return;
    }
    const session = await prisma.authSession.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { user: { include: authUserDetails } },
    });
    if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE" || !session.user.passwordHash) {
      if (session) await prisma.authSession.deleteMany({ where: { id: session.id } });
      clearSessionCookie(response);
      response.status(401).json({ error: "Your session has expired. Please sign in again." });
      return;
    }
    response.locals.authUser = presentUser(session.user);
    next();
  })().catch(next);
}

const modulePrefixes: [string, AccessModule][] = [
  ["/api/products", "INVENTORY"],
  ["/api/production", "PRODUCTION"],
  ["/api/orders", "ORDERS"],
  ["/api/reports", "REPORTS"],
  ["/api/users", "USER_ACCESS"],
  ["/api/support", "SUPPORT"],
  ["/api/settings", "SETTINGS"],
];

function requireModulePermission(request: Request, response: Response, next: NextFunction) {
  const requestPath = request.originalUrl.split("?")[0];
  const requiredModule = modulePrefixes.find(([prefix]) =>
    requestPath === prefix || requestPath.startsWith(`${prefix}/`),
  )?.[1];
  const user = response.locals.authUser as ReturnType<typeof presentUser> | undefined;
  if (!user) {
    response.status(401).json({ error: "Sign in to continue." });
    return;
  }
  if (requiredModule && !user.permissions[requiredModule]) {
    response.status(403).json({ error: "You do not have permission to access this module." });
    return;
  }
  if (requiredModule === "USER_ACCESS" && user.role !== "ADMIN") {
    response.status(403).json({ error: "Only administrator accounts can manage team access." });
    return;
  }
  next();
}

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/auth/status", async (_request, response, next) => {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: 1 }, select: { authSetupComplete: true } });
    response.json({
      setupRequired: !settings?.authSetupComplete,
      setupAvailable: (process.env.AUTH_SETUP_SECRET || "").length >= 32,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/setup", async (request, response, next) => {
  const address = `setup:${request.ip || "unknown"}`;
  const retryAfter = checkLoginRateLimit(address);
  if (retryAfter > 0) {
    response.setHeader("Retry-After", String(retryAfter));
    response.status(429).json({ error: "Too many setup attempts. Try again later." });
    return;
  }
  const { setupSecret, fullName, email, password } = isRecord(request.body) ? request.body : {};
  const configuredSecret = process.env.AUTH_SETUP_SECRET || "";
  if (configuredSecret.length < 32) {
    response.status(503).json({ error: "Initial setup is disabled. Configure AUTH_SETUP_SECRET with at least 32 characters." });
    return;
  }
  if (typeof setupSecret !== "string" || !timingSafeEqual(
    createHash("sha256").update(setupSecret).digest(),
    createHash("sha256").update(configuredSecret).digest(),
  ) || setupSecret.length !== configuredSecret.length) {
    response.status(401).json({ error: "Setup secret is incorrect." });
    return;
  }
  if (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 120) {
    response.status(400).json({ error: "Enter your name (up to 120 characters)." });
    return;
  }
  if (typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    response.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    response.status(400).json({ error: "Password must be between 12 and 128 characters." });
    return;
  }

  try {
    const passwordHash = await hashPassword(password);
    const cleanEmail = email.trim().toLowerCase();
    const user = await prisma.$transaction(async (transaction) => {
      await transaction.appSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
      const claim = await transaction.appSettings.updateMany({
        where: { id: 1, authSetupComplete: false },
        data: { authSetupComplete: true },
      });
      if (claim.count !== 1) return null;
      const existing = await transaction.userAccount.findUnique({ where: { email: cleanEmail } });
      if (existing) {
        return transaction.userAccount.update({
          where: { id: existing.id },
          data: {
            fullName: fullName.trim(),
            passwordHash,
            role: "ADMIN",
            status: "ACTIVE",
            permissions: {
              deleteMany: {},
              create: accessModules.map((module) => ({ module, canView: true })),
            },
          },
          include: { permissions: true },
        });
      }
      return transaction.userAccount.create({
        data: {
          fullName: fullName.trim(),
          email: cleanEmail,
          passwordHash,
          role: "ADMIN",
          status: "ACTIVE",
          permissions: { create: accessModules.map((module) => ({ module, canView: true })) },
        },
        include: { permissions: true },
      });
    });
    if (!user) {
      response.status(409).json({ error: "Initial setup has already been completed." });
      return;
    }
    resetLoginRateLimit(address);
    await createSession(user.id, response);
    response.status(201).json(presentUser(user));
  } catch (error) {
    next(error);
  }
});

const dummyPasswordHash = hashPassword(randomBytes(32).toString("hex"));

app.post("/api/auth/login", async (request, response, next) => {
  const address = `login:${request.ip || "unknown"}`;
  const retryAfter = checkLoginRateLimit(address);
  if (retryAfter > 0) {
    response.setHeader("Retry-After", String(retryAfter));
    response.status(429).json({ error: "Too many sign-in attempts. Try again later." });
    return;
  }
  const { email, password } = isRecord(request.body) ? request.body : {};
  if (typeof email !== "string" || typeof password !== "string" || password.length > 128) {
    response.status(400).json({ error: "Enter your email address and password." });
    return;
  }
  try {
    const user = await prisma.userAccount.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { permissions: true },
    });
    const encodedPassword = user?.passwordHash || await dummyPasswordHash;
    const passwordValid = await verifyPassword(password, encodedPassword);
    if (!user || !passwordValid || user.status !== "ACTIVE") {
      response.status(401).json({ error: "Email or password is incorrect." });
      return;
    }
    resetLoginRateLimit(address);
    await createSession(user.id, response);
    response.json(presentUser(user));
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuthentication, (request, response) => {
  response.json(response.locals.authUser);
});

app.post("/api/auth/logout", requireAuthentication, async (request, response, next) => {
  const token = sessionTokenFromRequest(request);
  if (!token) {
    response.status(401).json({ error: "Sign in to continue." });
    return;
  }
  try {
    await prisma.authSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
    clearSessionCookie(response);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use("/api", requireAuthentication, requireModulePermission);

app.get("/api/settings", async (_request, response, next) => {
  try {
    const settings = await prisma.appSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });
    response.json(settings);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/settings", async (request, response, next) => {
  const parsed = parseAppSettings(request.body);
  if (typeof parsed === "string") {
    response.status(400).json({ error: parsed });
    return;
  }
  try {
    const settings = await prisma.appSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...parsed },
      update: parsed,
    });
    response.json(settings);
  } catch (error) {
    next(error);
  }
});

const userAccountDetails = { permissions: { orderBy: { module: "asc" as const } } };

function presentUser(user: {
  id: number;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  permissions: { module: string; canView: boolean }[];
}) {
  const permissions = { ...roleDefaults[user.role as UserRole] };
  for (const permission of user.permissions) {
    if (accessModules.includes(permission.module as AccessModule)) {
      permissions[permission.module as AccessModule] = permission.canView;
    }
  }
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    permissions,
  };
}

app.get("/api/users", async (_request, response, next) => {
  try {
    const users = await prisma.userAccount.findMany({
      include: userAccountDetails,
      orderBy: { createdAt: "desc" },
    });
    response.json(users.map(presentUser));
  } catch (error) {
    next(error);
  }
});

app.post("/api/users", async (request, response, next) => {
  const parsed = parseUserAccount(request.body, true);
  if (typeof parsed === "string") {
    response.status(400).json({ error: parsed });
    return;
  }
  try {
    if (!parsed.password) {
      response.status(400).json({ error: "Set an initial password for this user." });
      return;
    }
    const passwordHash = await hashPassword(parsed.password);
    const user = await prisma.userAccount.create({
      data: {
        fullName: parsed.fullName,
        email: parsed.email,
        passwordHash,
        role: parsed.role,
        status: parsed.status,
        permissions: {
          create: accessModules.map((module) => ({
            module,
            canView: parsed.permissions[module],
          })),
        },
      },
      include: userAccountDetails,
    });
    response.status(201).json(presentUser(user));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/users/:id", async (request, response, next) => {
  const id = parseId(request.params.id);
  if (id === null) {
    response.status(400).json({ error: "User ID must be a positive integer." });
    return;
  }
  const parsed = parseUserAccount(request.body);
  if (typeof parsed === "string") {
    response.status(400).json({ error: parsed });
    return;
  }
  const currentUser = response.locals.authUser as ReturnType<typeof presentUser>;
  if (currentUser.id === id && parsed.status !== "ACTIVE") {
    response.status(409).json({ error: "You cannot disable the account you are currently using." });
    return;
  }
  if (currentUser.id === id && parsed.password) {
    response.status(409).json({ error: "Use another administrator account to change your password." });
    return;
  }
  try {
    const existing = await prisma.userAccount.findUnique({ where: { id }, select: { role: true, status: true } });
    if (existing?.role === "ADMIN" && existing.status === "ACTIVE" && (parsed.role !== "ADMIN" || parsed.status !== "ACTIVE")) {
      const otherAdmins = await prisma.userAccount.count({
        where: { id: { not: id }, role: "ADMIN", status: "ACTIVE", passwordHash: { not: null } },
      });
      if (otherAdmins === 0) {
        response.status(409).json({ error: "The last active administrator cannot be disabled or demoted." });
        return;
      }
    }
    const passwordHash = parsed.password ? await hashPassword(parsed.password) : undefined;
    const user = await prisma.userAccount.update({
      where: { id },
      data: {
        fullName: parsed.fullName,
        email: parsed.email,
        passwordHash,
        role: parsed.role,
        status: parsed.status,
        permissions: {
          deleteMany: {},
          create: accessModules.map((module) => ({
            module,
            canView: parsed.permissions[module],
          })),
        },
      },
      include: userAccountDetails,
    });
    if (parsed.password || parsed.status !== "ACTIVE") {
      await prisma.authSession.deleteMany({ where: { userId: id } });
    }
    response.json(presentUser(user));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/users/:id", async (request, response, next) => {
  const id = parseId(request.params.id);
  if (id === null) {
    response.status(400).json({ error: "User ID must be a positive integer." });
    return;
  }
  const currentUser = response.locals.authUser as ReturnType<typeof presentUser>;
  if (currentUser.id === id) {
    response.status(409).json({ error: "You cannot remove the account you are currently using." });
    return;
  }
  try {
    const existing = await prisma.userAccount.findUnique({ where: { id }, select: { role: true, status: true } });
    if (existing?.role === "ADMIN" && existing.status === "ACTIVE") {
      const otherAdmins = await prisma.userAccount.count({
        where: { id: { not: id }, role: "ADMIN", status: "ACTIVE", passwordHash: { not: null } },
      });
      if (otherAdmins === 0) {
        response.status(409).json({ error: "The last active administrator cannot be removed." });
        return;
      }
    }
    await prisma.userAccount.delete({ where: { id } });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

const supportTicketDetails = { replies: { orderBy: { createdAt: "asc" as const } } };

app.get("/api/support/tickets", async (_request, response, next) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      include: supportTicketDetails,
      orderBy: { updatedAt: "desc" },
    });
    response.json(tickets);
  } catch (error) {
    next(error);
  }
});

app.post("/api/support/tickets", async (request, response, next) => {
  const parsed = parseSupportTicket(request.body);
  if (typeof parsed === "string") {
    response.status(400).json({ error: parsed });
    return;
  }
  try {
    const ticket = await prisma.supportTicket.create({
      data: parsed,
      include: supportTicketDetails,
    });
    response.status(201).json(ticket);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/support/tickets/:id", async (request, response, next) => {
  const id = parseId(request.params.id);
  if (id === null) {
    response.status(400).json({ error: "Ticket ID must be a positive integer." });
    return;
  }
  const status = isRecord(request.body) ? request.body.status : undefined;
  if (typeof status !== "string" || !supportStatuses.includes(status as (typeof supportStatuses)[number])) {
    response.status(400).json({ error: "Status must be Open, In Progress, or Resolved." });
    return;
  }
  try {
    const existing = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      response.status(404).json({ error: "Support ticket not found." });
      return;
    }
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { status },
      include: supportTicketDetails,
    });
    response.json(ticket);
  } catch (error) {
    next(error);
  }
});

app.post("/api/support/tickets/:id/replies", async (request, response, next) => {
  const id = parseId(request.params.id);
  if (id === null) {
    response.status(400).json({ error: "Ticket ID must be a positive integer." });
    return;
  }
  const parsed = parseSupportReply(request.body);
  if (typeof parsed === "string") {
    response.status(400).json({ error: parsed });
    return;
  }
  try {
    const existing = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      response.status(404).json({ error: "Support ticket not found." });
      return;
    }
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        replies: { create: { author: "Support team", message: parsed.message } },
      },
      include: supportTicketDetails,
    });
    response.status(201).json(ticket);
  } catch (error) {
    next(error);
  }
});

app.get("/api/products", async (_request, response, next) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
    response.json(products);
  } catch (error) {
    next(error);
  }
});

app.post("/api/products", async (request, response, next) => {
  const parsed = parseProduct(request.body);
  if (typeof parsed === "string") {
    response.status(400).json({ error: parsed });
    return;
  }
  try {
    const product = await prisma.product.create({ data: parsed });
    response.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/products/:id", async (request, response, next) => {
  const id = parseId(request.params.id);
  if (id === null) {
    response.status(400).json({ error: "Product ID must be a positive integer." });
    return;
  }
  const parsed = parseProduct(request.body);
  if (typeof parsed === "string") {
    response.status(400).json({ error: parsed });
    return;
  }
  try {
    const product = await prisma.product.update({ where: { id }, data: parsed });
    response.json(product);
  } catch (error) {
    next(error);
  }
});

app.post("/api/products/:id/sales", async (request, response, next) => {
  const id = parseId(request.params.id);
  if (id === null) {
    response.status(400).json({ error: "Product ID must be a positive integer." });
    return;
  }
  const quantity = isRecord(request.body) ? request.body.quantity : undefined;
  if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1) {
    response.status(400).json({ error: "Sale quantity must be a positive whole number." });
    return;
  }
  try {
    const result = await prisma.product.updateMany({
      where: { id, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (result.count === 0) {
      const product = await prisma.product.findUnique({ where: { id } });
      response.status(product ? 409 : 404).json({
        error: product ? "Sale quantity exceeds available stock." : "Product not found.",
      });
      return;
    }
    const product = await prisma.product.findUniqueOrThrow({ where: { id } });
    response.json(product);
  } catch (error) {
    next(error);
  }
});

const salesOrderDetails = {
  items: { orderBy: { id: "asc" as const } },
};

app.get("/api/orders", async (_request, response, next) => {
  try {
    const orders = await prisma.salesOrder.findMany({
      include: salesOrderDetails,
      orderBy: { createdAt: "desc" },
    });
    response.json(orders);
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", async (request, response, next) => {
  const parsed = parseSalesOrder(request.body);
  if (typeof parsed === "string") {
    response.status(400).json({ error: parsed });
    return;
  }
  try {
    const products = await prisma.product.findMany({
      where: { id: { in: parsed.items.map((item) => item.productId) } },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        stock: true,
        unitPrice: true,
      },
    });
    if (products.length !== parsed.items.length) {
      response.status(404).json({ error: "One or more order products were not found." });
      return;
    }
    const notSellable = products.find((product) => product.category !== "Finished Good");
    if (notSellable) {
      response.status(400).json({ error: `${notSellable.name} is not a finished good available for sale.` });
      return;
    }
    for (const item of parsed.items) {
      const product = products.find((candidate) => candidate.id === item.productId)!;
      if (item.quantity > product.stock) {
        response.status(409).json({
          error: `Insufficient ${product.name}: ${item.quantity} requested, ${product.stock} currently available.`,
        });
        return;
      }
    }
    const productById = new Map(products.map((product) => [product.id, product]));
    const orderItems = parsed.items.map((item) => {
      const product = productById.get(item.productId)!;
      return {
        ...item,
        productName: product.name,
        sku: product.sku,
        unitPrice: product.unitPrice,
      };
    });
    const totalAmount = Math.round(
      orderItems.reduce((total, item) => total + item.quantity * item.unitPrice, 0) * 100,
    ) / 100;
    if (!Number.isFinite(totalAmount)) {
      response.status(400).json({ error: "Order total exceeds supported limits." });
      return;
    }
    const order = await prisma.salesOrder.create({
      data: {
        customer: parsed.customer,
        email: parsed.email,
        notes: parsed.notes,
        totalAmount,
        items: { create: orderItems },
      },
      include: salesOrderDetails,
    });
    response.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders/:id/process", async (request, response, next) => {
  const id = parseId(request.params.id);
  if (id === null) {
    response.status(400).json({ error: "Order ID must be a positive integer." });
    return;
  }
  try {
    const changed = await prisma.salesOrder.updateMany({
      where: { id, status: "OPEN" },
      data: { status: "PROCESSING" },
    });
    if (changed.count !== 1) {
      const order = await prisma.salesOrder.findUnique({ where: { id }, select: { id: true } });
      response.status(order ? 409 : 404).json({
        error: order ? "Only open orders can be moved to processing." : "Order not found.",
      });
      return;
    }
    const order = await prisma.salesOrder.findUniqueOrThrow({
      where: { id },
      include: salesOrderDetails,
    });
    response.json(order);
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders/:id/fulfill", async (request, response, next) => {
  const id = parseId(request.params.id);
  if (id === null) {
    response.status(400).json({ error: "Order ID must be a positive integer." });
    return;
  }
  try {
    const order = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.salesOrder.findUnique({
        where: { id },
        include: salesOrderDetails,
      });
      if (!existing) throw new ProductionError("Order not found.", 404);
      if (existing.status !== "OPEN" && existing.status !== "PROCESSING") {
        throw new ProductionError("Only open or processing orders can be fulfilled.", 409);
      }
      const claimed = await transaction.salesOrder.updateMany({
        where: { id, status: { in: ["OPEN", "PROCESSING"] } },
        data: { status: "FULFILLED", fulfilledAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new ProductionError("This order has already been processed.", 409);
      }
      for (const item of existing.items) {
        const updated = await transaction.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count !== 1) {
          const product = await transaction.product.findUnique({
            where: { id: item.productId },
            select: { name: true, stock: true },
          });
          throw new ProductionError(
            product
              ? `Insufficient ${product.name}: ${item.quantity} required, ${product.stock} available.`
              : `${item.productName} is no longer available.`,
            product ? 409 : 404,
          );
        }
      }
      return transaction.salesOrder.findUniqueOrThrow({
        where: { id },
        include: salesOrderDetails,
      });
    });
    response.json(order);
  } catch (error) {
    if (error instanceof ProductionError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.post("/api/orders/:id/cancel", async (request, response, next) => {
  const id = parseId(request.params.id);
  if (id === null) {
    response.status(400).json({ error: "Order ID must be a positive integer." });
    return;
  }
  try {
    const changed = await prisma.salesOrder.updateMany({
      where: { id, status: { in: ["OPEN", "PROCESSING"] } },
      data: { status: "CANCELLED" },
    });
    if (changed.count !== 1) {
      const order = await prisma.salesOrder.findUnique({ where: { id }, select: { id: true } });
      response.status(order ? 409 : 404).json({
        error: order ? "Only open or processing orders can be cancelled." : "Order not found.",
      });
      return;
    }
    const order = await prisma.salesOrder.findUniqueOrThrow({
      where: { id },
      include: salesOrderDetails,
    });
    response.json(order);
  } catch (error) {
    next(error);
  }
});

function parseReportDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === value ? date : null;
}

app.get("/api/reports/sales", async (request, response, next) => {
  const fromDate = parseReportDate(request.query.from);
  const toDate = parseReportDate(request.query.to);
  if (!fromDate || !toDate) {
    response.status(400).json({ error: "Provide valid from and to dates in YYYY-MM-DD format." });
    return;
  }
  const rangeDays = (toDate.getTime() - fromDate.getTime()) / 86_400_000;
  if (rangeDays < 0) {
    response.status(400).json({ error: "The start date must be on or before the end date." });
    return;
  }
  if (rangeDays > 365) {
    response.status(400).json({ error: "Report date range cannot exceed 366 days." });
    return;
  }

  const endExclusive = new Date(toDate.getTime() + 86_400_000);
  try {
    const fulfilledOrders = await prisma.salesOrder.findMany({
      where: {
        status: "FULFILLED",
        fulfilledAt: { gte: fromDate, lt: endExclusive },
      },
      include: { items: true },
      orderBy: { fulfilledAt: "asc" },
    });
    const dailyTotals = new Map<string, { revenue: number; orders: number }>();
    const productTotals = new Map<string, {
      productName: string;
      sku: string;
      quantity: number;
      revenue: number;
    }>();
    const orderRows = [];
    let revenue = 0;
    let unitsSold = 0;
    for (const order of fulfilledOrders) {
      revenue += order.totalAmount;
      const date = order.fulfilledAt!.toISOString().slice(0, 10);
      const day = dailyTotals.get(date) ?? { revenue: 0, orders: 0 };
      day.revenue += order.totalAmount;
      day.orders += 1;
      dailyTotals.set(date, day);
      for (const item of order.items) {
        unitsSold += item.quantity;
        const key = `${item.productId}:${item.sku}`;
        const product = productTotals.get(key) ?? {
          productName: item.productName,
          sku: item.sku,
          quantity: 0,
          revenue: 0,
        };
        product.quantity += item.quantity;
        product.revenue += item.quantity * item.unitPrice;
        productTotals.set(key, product);
        orderRows.push({
          orderNumber: `SO-${String(order.id).padStart(5, "0")}`,
          fulfilledAt: date,
          customer: order.customer,
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: Math.round(item.quantity * item.unitPrice * 100) / 100,
        });
      }
    }

    const daily = [];
    for (let offset = 0; offset <= rangeDays; offset += 1) {
      const date = new Date(fromDate.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
      const totals = dailyTotals.get(date) ?? { revenue: 0, orders: 0 };
      daily.push({ date, revenue: Math.round(totals.revenue * 100) / 100, orders: totals.orders });
    }
    const products = [...productTotals.values()]
      .sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue)
      .slice(0, 10)
      .map((product) => ({ ...product, revenue: Math.round(product.revenue * 100) / 100 }));
    const roundedRevenue = Math.round(revenue * 100) / 100;
    response.json({
      from: request.query.from,
      to: request.query.to,
      summary: {
        revenue: roundedRevenue,
        orderCount: fulfilledOrders.length,
        unitsSold,
        averageOrderValue: fulfilledOrders.length
          ? Math.round((roundedRevenue / fulfilledOrders.length) * 100) / 100
          : 0,
      },
      daily,
      topProducts: products,
      orderRows,
    });
  } catch (error) {
    next(error);
  }
});

const productionOrderDetails = {
  outputProduct: true,
  materials: { include: { product: true } },
} as const;

app.get("/api/production/orders", async (_request, response, next) => {
  try {
    const orders = await prisma.productionOrder.findMany({
      include: productionOrderDetails,
      orderBy: { createdAt: "desc" },
    });
    response.json(orders);
  } catch (error) {
    next(error);
  }
});

app.post("/api/production/orders", async (request, response, next) => {
  const parsed = parseProductionOrder(request.body);
  if (typeof parsed === "string") {
    response.status(400).json({ error: parsed });
    return;
  }
  try {
    const productIds = [parsed.outputProductId, ...parsed.materials.map((item) => item.productId)];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, category: true },
    });
    const output = products.find((product) => product.id === parsed.outputProductId);
    if (!output) {
      response.status(404).json({ error: "Finished product not found." });
      return;
    }
    if (output.category !== "Finished Good") {
      response.status(400).json({ error: "Production output must be a Finished Good." });
      return;
    }
    const rawMaterials = products.filter((product) => product.id !== parsed.outputProductId);
    if (rawMaterials.length !== parsed.materials.length) {
      response.status(404).json({ error: "One or more raw materials were not found." });
      return;
    }
    const invalidMaterial = rawMaterials.find((product) => product.category !== "Raw Material");
    if (invalidMaterial) {
      response.status(400).json({ error: `${invalidMaterial.name} is not a Raw Material.` });
      return;
    }

    const order = await prisma.productionOrder.create({
      data: {
        outputProductId: parsed.outputProductId,
        quantity: parsed.quantity,
        materials: { create: parsed.materials },
      },
      include: productionOrderDetails,
    });
    response.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

app.post("/api/production/orders/:id/complete", async (request, response, next) => {
  const id = parseId(request.params.id);
  if (id === null) {
    response.status(400).json({ error: "Production order ID must be a positive integer." });
    return;
  }
  try {
    const order = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.productionOrder.findUnique({
        where: { id },
        include: productionOrderDetails,
      });
      if (!existing) throw new ProductionError("Production order not found.", 404);
      if (existing.status !== "PLANNED") {
        throw new ProductionError("This production order is no longer planned.", 409);
      }
      if (existing.outputProduct.stock + existing.quantity > maxDatabaseInteger) {
        throw new ProductionError("Finished product stock would exceed the supported limit.", 409);
      }

      const claimed = await transaction.productionOrder.updateMany({
        where: { id, status: "PLANNED" },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new ProductionError("This production order has already been processed.", 409);
      }

      for (const material of existing.materials) {
        const required = material.quantityPerUnit * existing.quantity;
        if (!Number.isSafeInteger(required) || required > maxDatabaseInteger) {
          throw new ProductionError("Required material quantity exceeds available stock limits.", 409);
        }
        const consumed = await transaction.product.updateMany({
          where: { id: material.productId, stock: { gte: required } },
          data: { stock: { decrement: required } },
        });
        if (consumed.count !== 1) {
          const current = await transaction.product.findUnique({
            where: { id: material.productId },
            select: { name: true, stock: true },
          });
          throw new ProductionError(
            current
              ? `Insufficient ${current.name}: ${required} required, ${current.stock} available.`
              : "A required raw material no longer exists.",
            current ? 409 : 404,
          );
        }
      }

      await transaction.product.update({
        where: { id: existing.outputProductId },
        data: { stock: { increment: existing.quantity } },
      });
      return transaction.productionOrder.findUniqueOrThrow({
        where: { id },
        include: productionOrderDetails,
      });
    });
    response.json(order);
  } catch (error) {
    if (error instanceof ProductionError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.post("/api/production/orders/:id/cancel", async (request, response, next) => {
  const id = parseId(request.params.id);
  if (id === null) {
    response.status(400).json({ error: "Production order ID must be a positive integer." });
    return;
  }
  try {
    const changed = await prisma.productionOrder.updateMany({
      where: { id, status: "PLANNED" },
      data: { status: "CANCELLED" },
    });
    if (changed.count !== 1) {
      const order = await prisma.productionOrder.findUnique({
        where: { id },
        select: { id: true },
      });
      response.status(order ? 409 : 404).json({
        error: order ? "Only planned orders can be cancelled." : "Production order not found.",
      });
      return;
    }
    const order = await prisma.productionOrder.findUniqueOrThrow({
      where: { id },
      include: productionOrderDetails,
    });
    response.json(order);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/products/:id", async (request, response, next) => {
  const id = parseId(request.params.id);
  if (id === null) {
    response.status(400).json({ error: "Product ID must be a positive integer." });
    return;
  }
  try {
    await prisma.product.delete({ where: { id } });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

const errors: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      response.status(409).json({ error: "A record with this unique value already exists." });
      return;
    }
    if (error.code === "P2025") {
      response.status(404).json({ error: "Product not found." });
      return;
    }
    if (error.code === "P2003") {
      response.status(409).json({ error: "This product is referenced by an order and cannot be deleted." });
      return;
    }
  }
  console.error("API request failed:", error);
  response.status(500).json({ error: "An unexpected server error occurred." });
};
app.use(errors);

export default app;

if (!process.env.VERCEL) {
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Inventra API listening on http://localhost:${port}`);
  });

  async function shutdown() {
    server.close();
    await prisma.$disconnect();
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
