import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SYSTEM_ROLES } from "../src/lib/authz";

const db = new PrismaClient();

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@zentrades.pro").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";

  // ── Organization ────────────────────────────────────────────
  const org = await db.organization.upsert({
    where: { slug: "zentrades" },
    update: {},
    create: {
      name: "ZenTrades",
      slug: "zentrades",
      settings: { currency: "USD", dateFormat: "MMM d, yyyy", fiscalYearStartMonth: 1 },
    },
  });

  // ── System roles ────────────────────────────────────────────
  const roles: Record<string, string> = {};
  for (const [name, def] of Object.entries(SYSTEM_ROLES)) {
    const role = await db.role.upsert({
      where: { orgId_name: { orgId: org.id, name } },
      update: { permissions: def.permissions },
      create: { orgId: org.id, name, permissions: def.permissions, isSystem: true },
    });
    roles[name] = role.id;
  }

  // ── Admin user + membership ─────────────────────────────────
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: { email: adminEmail, name: "Admin", passwordHash },
  });
  await db.membership.upsert({
    where: { userId_orgId: { userId: admin.id, orgId: org.id } },
    update: { roleId: roles["Admin"], status: "ACTIVE" },
    create: { userId: admin.id, orgId: org.id, roleId: roles["Admin"], status: "ACTIVE" },
  });

  // ── Reference data ─────────────────────────────────────────
  const hq = await db.site.upsert({
    where: { orgId_name: { orgId: org.id, name: "Headquarters" } },
    update: {},
    create: { orgId: org.id, name: "Headquarters", address: "Ahmedabad, IN" },
  });
  const warehouse = await db.site.upsert({
    where: { orgId_name: { orgId: org.id, name: "Warehouse" } },
    update: {},
    create: { orgId: org.id, name: "Warehouse" },
  });

  for (const name of ["IT Room", "Front Desk", "Conference Room"]) {
    const exists = await db.location.findFirst({ where: { orgId: org.id, siteId: hq.id, name } });
    if (!exists) await db.location.create({ data: { orgId: org.id, siteId: hq.id, name } });
  }
  const bayExists = await db.location.findFirst({
    where: { orgId: org.id, siteId: warehouse.id, name: "Bay A" },
  });
  if (!bayExists) await db.location.create({ data: { orgId: org.id, siteId: warehouse.id, name: "Bay A" } });

  for (const name of ["Laptop", "Monitor", "Phone", "Vehicle", "Power Tool", "Furniture"]) {
    await db.category.upsert({
      where: { orgId_name: { orgId: org.id, name } },
      update: {},
      create: { orgId: org.id, name, depreciationMethod: "STRAIGHT_LINE", defaultUsefulLifeMo: 36 },
    });
  }

  for (const name of ["Operations", "Field Service", "Sales", "Admin"]) {
    await db.department.upsert({
      where: { orgId_name: { orgId: org.id, name } },
      update: {},
      create: { orgId: org.id, name },
    });
  }

  for (const [name, email] of [
    ["Priya Shah", "priya@zentrades.pro"],
    ["Arjun Mehta", "arjun@zentrades.pro"],
    ["Sara Kim", "sara@zentrades.pro"],
  ] as const) {
    const exists = await db.person.findFirst({ where: { orgId: org.id, name } });
    if (!exists) await db.person.create({ data: { orgId: org.id, name, email } });
  }

  await db.company.upsert({
    where: { orgId_name: { orgId: org.id, name: "Dell Technologies" } },
    update: { isVendor: true, isManufacturer: true },
    create: { orgId: org.id, name: "Dell Technologies", isVendor: true, isManufacturer: true },
  });

  // ── Alert rules (defaults, inactive email until configured) ──
  for (const type of [
    "CHECKOUT_OVERDUE",
    "MAINT_DUE",
    "WARRANTY_EXPIRY",
    "CONTRACT_EXPIRY",
    "POLICY_EXPIRY",
    "LOW_STOCK",
  ]) {
    await db.alertRule.upsert({
      where: { orgId_type: { orgId: org.id, type } },
      update: {},
      create: { orgId: org.id, type, thresholdDays: 30, recipients: [adminEmail], cadence: "DAILY" },
    });
  }

  // ── Inventory (consumables) ─────────────────────────────────
  const itRoom = await db.location.findFirst({ where: { orgId: org.id, name: "IT Room" } });
  const bayA = await db.location.findFirst({ where: { orgId: org.id, name: "Bay A" } });
  if (itRoom && bayA) {
    for (const [sku, name, unit, qty, reorder] of [
      ["CBL-USBC-2M", "USB-C cable 2m", "ea", 24, 10],
      ["BAT-AA-24", "AA batteries (24-pack)", "pack", 3, 5],
      ["GLV-NITRILE-M", "Nitrile gloves M (box)", "box", 12, 6],
    ] as const) {
      const item = await db.inventoryItem.upsert({
        where: { orgId_sku: { orgId: org.id, sku } },
        update: {},
        create: { orgId: org.id, sku, name, unit, defaultReorderPoint: reorder },
      });
      const loc = sku === "GLV-NITRILE-M" ? bayA : itRoom;
      const existing = await db.inventoryStock.findUnique({
        where: { itemId_locationId: { itemId: item.id, locationId: loc.id } },
      });
      if (!existing) {
        await db.inventoryStock.create({
          data: { orgId: org.id, itemId: item.id, locationId: loc.id, quantity: qty, reorderPoint: reorder },
        });
        await db.inventoryTxn.create({
          data: { orgId: org.id, itemId: item.id, locationId: loc.id, delta: qty, type: "RECEIVE", reason: "Opening balance", byUserId: admin.id },
        });
      }
    }
  }

  console.log(`Seeded org "${org.name}" with admin ${adminEmail} / password "${adminPassword}"`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
