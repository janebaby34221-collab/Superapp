import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  const name = process.env.SUPERADMIN_NAME || "Super Admin";
  const phone = process.env.SUPERADMIN_PHONE || "0000000000";

  if (!email || !password) {
    throw new Error("❌ SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set in .env");
  }

  // hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // check if superadmin exists
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log("✅ SuperAdmin already exists:", existing.email);
  } else {
    const superadmin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role: "SUPERADMIN",
      },
    });
    console.log("🎉 SuperAdmin created:", superadmin.email);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });

