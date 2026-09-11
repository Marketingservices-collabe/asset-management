-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'CHECKED_OUT', 'LEASED', 'RESERVED', 'UNDER_REPAIR', 'DISPOSED', 'LOST');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'DECLINING_BALANCE_200', 'DECLINING_BALANCE_150', 'SUM_OF_YEARS_DIGITS', 'NONE');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'OVERDUE', 'DONE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOL', 'SELECT');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "twoFactorSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "defaultUsefulLifeMo" INTEGER,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "userId" TEXT,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isVendor" BOOLEAN NOT NULL DEFAULT false,
    "isManufacturer" BOOLEAN NOT NULL DEFAULT false,
    "isCustomer" BOOLEAN NOT NULL DEFAULT false,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDef" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "categoryId" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL DEFAULT 'TEXT',
    "options" TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CustomFieldDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serialNo" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "categoryId" TEXT,
    "siteId" TEXT,
    "locationId" TEXT,
    "departmentId" TEXT,
    "assignedPersonId" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchaseCost" DECIMAL(14,2),
    "poNumber" TEXT,
    "supplierId" TEXT,
    "fundId" TEXT,
    "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "salvageValue" DECIMAL(14,2),
    "usefulLifeMonths" INTEGER,
    "depreciationStart" TIMESTAMP(3),
    "bookValue" DECIMAL(14,2),
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldValue" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fieldDefId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DECIMAL(18,4),
    "valueDate" TIMESTAMP(3),
    "valueBool" BOOLEAN,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetEvent" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "summary" TEXT NOT NULL,
    "dataJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "AssetEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutRecord" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "personId" TEXT,
    "toLocationId" TEXT,
    "checkedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "notes" TEXT,
    "outByUserId" TEXT NOT NULL,
    "inByUserId" TEXT,

    CONSTRAINT "CheckoutRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseRecord" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "customerCompanyId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "rate" DECIMAL(14,2),
    "terms" TEXT,

    CONSTRAINT "LeaseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "fromAt" TIMESTAMP(3) NOT NULL,
    "toAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoveRecord" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fromSiteId" TEXT,
    "fromLocationId" TEXT,
    "toSiteId" TEXT,
    "toLocationId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byUserId" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "MoveRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisposalRecord" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proceeds" DECIMAL(14,2),
    "notes" TEXT,
    "byUserId" TEXT NOT NULL,

    CONSTRAINT "DisposalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceSchedule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assetId" TEXT,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "intervalDays" INTEGER,
    "fixedDates" JSONB,
    "leadDays" INTEGER NOT NULL DEFAULT 7,
    "assignedToPersonId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextDueAt" TIMESTAMP(3),

    CONSTRAINT "MaintenanceSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "technician" TEXT,
    "workPerformed" TEXT,
    "cost" DECIMAL(14,2),
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warranty" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "provider" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3) NOT NULL,
    "terms" TEXT,
    "leadDays" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendorCompanyId" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "value" DECIMAL(14,2),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "leadDays" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractAsset" (
    "contractId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "ContractAsset_pkey" PRIMARY KEY ("contractId","assetId")
);

-- CreateTable
CREATE TABLE "InsurancePolicy" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "policyNo" TEXT,
    "coverageAmount" DECIMAL(14,2),
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "leadDays" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyAsset" (
    "policyId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "PolicyAsset_pkey" PRIMARY KEY ("policyId","assetId")
);

-- CreateTable
CREATE TABLE "Fund" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "amount" DECIMAL(14,2),
    "source" TEXT,

    CONSTRAINT "Fund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepreciationEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "bookValue" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "DepreciationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ea',
    "categoryId" TEXT,
    "defaultReorderPoint" INTEGER,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStock" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER,

    CONSTRAINT "InventoryStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTxn" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byUserId" TEXT NOT NULL,

    CONSTRAINT "InventoryTxn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siteId" TEXT,
    "locationId" TEXT,
    "categoryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditScan" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "assetId" TEXT,
    "rawTag" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "foundLocationId" TEXT,
    "result" TEXT NOT NULL,

    CONSTRAINT "AuditScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'DOCUMENT',
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "thresholdDays" INTEGER NOT NULL DEFAULT 30,
    "recipients" JSONB NOT NULL DEFAULT '[]',
    "cadence" TEXT NOT NULL DEFAULT 'DAILY',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "emailedAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ip" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "entity" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRun" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "reportKey" TEXT NOT NULL,
    "paramsJson" JSONB NOT NULL DEFAULT '{}',
    "fileKey" TEXT,
    "format" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_orgId_name_key" ON "Role"("orgId", "name");

-- CreateIndex
CREATE INDEX "Site_orgId_idx" ON "Site"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Site_orgId_name_key" ON "Site"("orgId", "name");

-- CreateIndex
CREATE INDEX "Location_orgId_idx" ON "Location"("orgId");

-- CreateIndex
CREATE INDEX "Location_siteId_idx" ON "Location"("siteId");

-- CreateIndex
CREATE INDEX "Category_orgId_idx" ON "Category"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_orgId_name_key" ON "Category"("orgId", "name");

-- CreateIndex
CREATE INDEX "Department_orgId_idx" ON "Department"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_orgId_name_key" ON "Department"("orgId", "name");

-- CreateIndex
CREATE INDEX "Person_orgId_idx" ON "Person"("orgId");

-- CreateIndex
CREATE INDEX "Company_orgId_idx" ON "Company"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_orgId_name_key" ON "Company"("orgId", "name");

-- CreateIndex
CREATE INDEX "CustomFieldDef_orgId_idx" ON "CustomFieldDef"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDef_orgId_categoryId_key_key" ON "CustomFieldDef"("orgId", "categoryId", "key");

-- CreateIndex
CREATE INDEX "Asset_orgId_idx" ON "Asset"("orgId");

-- CreateIndex
CREATE INDEX "Asset_orgId_status_idx" ON "Asset"("orgId", "status");

-- CreateIndex
CREATE INDEX "Asset_categoryId_idx" ON "Asset"("categoryId");

-- CreateIndex
CREATE INDEX "Asset_locationId_idx" ON "Asset"("locationId");

-- CreateIndex
CREATE INDEX "Asset_assignedPersonId_idx" ON "Asset"("assignedPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_orgId_tagId_key" ON "Asset"("orgId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldValue_assetId_fieldDefId_key" ON "CustomFieldValue"("assetId", "fieldDefId");

-- CreateIndex
CREATE INDEX "AssetEvent_assetId_at_idx" ON "AssetEvent"("assetId", "at");

-- CreateIndex
CREATE INDEX "CheckoutRecord_orgId_idx" ON "CheckoutRecord"("orgId");

-- CreateIndex
CREATE INDEX "CheckoutRecord_assetId_idx" ON "CheckoutRecord"("assetId");

-- CreateIndex
CREATE INDEX "CheckoutRecord_orgId_checkedInAt_idx" ON "CheckoutRecord"("orgId", "checkedInAt");

-- CreateIndex
CREATE INDEX "LeaseRecord_orgId_idx" ON "LeaseRecord"("orgId");

-- CreateIndex
CREATE INDEX "LeaseRecord_assetId_idx" ON "LeaseRecord"("assetId");

-- CreateIndex
CREATE INDEX "Reservation_orgId_idx" ON "Reservation"("orgId");

-- CreateIndex
CREATE INDEX "Reservation_assetId_fromAt_idx" ON "Reservation"("assetId", "fromAt");

-- CreateIndex
CREATE INDEX "MoveRecord_orgId_idx" ON "MoveRecord"("orgId");

-- CreateIndex
CREATE INDEX "MoveRecord_assetId_idx" ON "MoveRecord"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "DisposalRecord_assetId_key" ON "DisposalRecord"("assetId");

-- CreateIndex
CREATE INDEX "DisposalRecord_orgId_idx" ON "DisposalRecord"("orgId");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_orgId_idx" ON "MaintenanceSchedule"("orgId");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_orgId_nextDueAt_idx" ON "MaintenanceSchedule"("orgId", "nextDueAt");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_orgId_idx" ON "MaintenanceRecord"("orgId");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_assetId_idx" ON "MaintenanceRecord"("assetId");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_orgId_status_idx" ON "MaintenanceRecord"("orgId", "status");

-- CreateIndex
CREATE INDEX "Warranty_orgId_idx" ON "Warranty"("orgId");

-- CreateIndex
CREATE INDEX "Warranty_orgId_endAt_idx" ON "Warranty"("orgId", "endAt");

-- CreateIndex
CREATE INDEX "Contract_orgId_idx" ON "Contract"("orgId");

-- CreateIndex
CREATE INDEX "Contract_orgId_endAt_idx" ON "Contract"("orgId", "endAt");

-- CreateIndex
CREATE INDEX "InsurancePolicy_orgId_idx" ON "InsurancePolicy"("orgId");

-- CreateIndex
CREATE INDEX "InsurancePolicy_orgId_endAt_idx" ON "InsurancePolicy"("orgId", "endAt");

-- CreateIndex
CREATE INDEX "Fund_orgId_idx" ON "Fund"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Fund_orgId_name_key" ON "Fund"("orgId", "name");

-- CreateIndex
CREATE INDEX "DepreciationEntry_orgId_idx" ON "DepreciationEntry"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "DepreciationEntry_assetId_periodEnd_key" ON "DepreciationEntry"("assetId", "periodEnd");

-- CreateIndex
CREATE INDEX "InventoryItem_orgId_idx" ON "InventoryItem"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_orgId_sku_key" ON "InventoryItem"("orgId", "sku");

-- CreateIndex
CREATE INDEX "InventoryStock_orgId_idx" ON "InventoryStock"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryStock_itemId_locationId_key" ON "InventoryStock"("itemId", "locationId");

-- CreateIndex
CREATE INDEX "InventoryTxn_orgId_idx" ON "InventoryTxn"("orgId");

-- CreateIndex
CREATE INDEX "InventoryTxn_itemId_at_idx" ON "InventoryTxn"("itemId", "at");

-- CreateIndex
CREATE INDEX "Audit_orgId_idx" ON "Audit"("orgId");

-- CreateIndex
CREATE INDEX "AuditScan_auditId_idx" ON "AuditScan"("auditId");

-- CreateIndex
CREATE INDEX "Attachment_orgId_entityType_entityId_idx" ON "Attachment"("orgId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertRule_orgId_type_key" ON "AlertRule"("orgId", "type");

-- CreateIndex
CREATE INDEX "Notification_orgId_readAt_idx" ON "Notification"("orgId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_orgId_type_entityId_period_key" ON "Notification"("orgId", "type", "entityId", "period");

-- CreateIndex
CREATE INDEX "ActivityLog_orgId_at_idx" ON "ActivityLog"("orgId", "at");

-- CreateIndex
CREATE INDEX "ActivityLog_orgId_entityType_entityId_idx" ON "ActivityLog"("orgId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "SavedView_orgId_entity_idx" ON "SavedView"("orgId", "entity");

-- CreateIndex
CREATE INDEX "ReportRun_orgId_reportKey_idx" ON "ReportRun"("orgId", "reportKey");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDef" ADD CONSTRAINT "CustomFieldDef_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDef" ADD CONSTRAINT "CustomFieldDef_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_assignedPersonId_fkey" FOREIGN KEY ("assignedPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_fieldDefId_fkey" FOREIGN KEY ("fieldDefId") REFERENCES "CustomFieldDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetEvent" ADD CONSTRAINT "AssetEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutRecord" ADD CONSTRAINT "CheckoutRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutRecord" ADD CONSTRAINT "CheckoutRecord_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseRecord" ADD CONSTRAINT "LeaseRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseRecord" ADD CONSTRAINT "LeaseRecord_customerCompanyId_fkey" FOREIGN KEY ("customerCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoveRecord" ADD CONSTRAINT "MoveRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisposalRecord" ADD CONSTRAINT "DisposalRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_assignedToPersonId_fkey" FOREIGN KEY ("assignedToPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "MaintenanceSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_vendorCompanyId_fkey" FOREIGN KEY ("vendorCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAsset" ADD CONSTRAINT "ContractAsset_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAsset" ADD CONSTRAINT "ContractAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAsset" ADD CONSTRAINT "PolicyAsset_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "InsurancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAsset" ADD CONSTRAINT "PolicyAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fund" ADD CONSTRAINT "Fund_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationEntry" ADD CONSTRAINT "DepreciationEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTxn" ADD CONSTRAINT "InventoryTxn_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditScan" ADD CONSTRAINT "AuditScan_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditScan" ADD CONSTRAINT "AuditScan_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
