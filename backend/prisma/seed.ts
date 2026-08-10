import { PrismaClient, Role, CustomerType, CustomerStatus, MovementType, ChallanStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const BCRYPT_ROUNDS = 12;

  // ─── Clear existing data (in dependency order) ─────────────────────────────
  console.log('  Clearing existing data...');
  await prisma.challanItem.deleteMany();
  await prisma.challan.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.customerNote.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // ─── Users ─────────────────────────────────────────────────────────────────
  console.log('  Creating users...');
  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@erp.local',
        passwordHash: await bcrypt.hash('Admin@123', BCRYPT_ROUNDS),
        role: Role.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Sales Executive',
        email: 'sales@erp.local',
        passwordHash: await bcrypt.hash('Sales@123', BCRYPT_ROUNDS),
        role: Role.SALES,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Warehouse Manager',
        email: 'warehouse@erp.local',
        passwordHash: await bcrypt.hash('Warehouse@123', BCRYPT_ROUNDS),
        role: Role.WAREHOUSE,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Accounts Officer',
        email: 'accounts@erp.local',
        passwordHash: await bcrypt.hash('Accounts@123', BCRYPT_ROUNDS),
        role: Role.ACCOUNTS,
      },
    }),
  ]);
  const [admin, sales, warehouse, accounts] = users;
  console.log(`  ✓ Created ${users.length} users`);

  // ─── Products ──────────────────────────────────────────────────────────────
  console.log('  Creating products...');
  const products = await Promise.all([
    prisma.product.create({ data: { name: 'Industrial Fan 36"', sku: 'FAN-IND-36', category: 'Electrical', unitPrice: 4500, currentStock: 85, minStockAlert: 20, warehouseLocation: 'A-01' } }),
    prisma.product.create({ data: { name: 'PVC Pipe 4 inch (per meter)', sku: 'PVC-004-M', category: 'Plumbing', unitPrice: 180, currentStock: 500, minStockAlert: 100, warehouseLocation: 'B-12' } }),
    prisma.product.create({ data: { name: 'Steel Bolt M12 x 50mm (Box of 100)', sku: 'BOLT-M12-50', category: 'Hardware', unitPrice: 850, currentStock: 120, minStockAlert: 30, warehouseLocation: 'C-05' } }),
    prisma.product.create({ data: { name: 'LED Tube Light 40W', sku: 'LED-TL-40W', category: 'Electrical', unitPrice: 320, currentStock: 8, minStockAlert: 25, warehouseLocation: 'A-08' } }), // Below alert
    prisma.product.create({ data: { name: 'Cable Tray 100mm x 3m', sku: 'CT-100-3M', category: 'Electrical', unitPrice: 650, currentStock: 45, minStockAlert: 15, warehouseLocation: 'A-14' } }),
    prisma.product.create({ data: { name: 'Hydraulic Jack 10 Ton', sku: 'HYD-J-10T', category: 'Tools', unitPrice: 8500, currentStock: 3, minStockAlert: 5, warehouseLocation: 'D-02' } }), // Below alert
    prisma.product.create({ data: { name: 'Bearing 6205 ZZ', sku: 'BRG-6205ZZ', category: 'Mechanical', unitPrice: 220, currentStock: 200, minStockAlert: 50, warehouseLocation: 'E-07' } }),
    prisma.product.create({ data: { name: 'Safety Helmet (Yellow)', sku: 'SAF-HLM-YEL', category: 'Safety', unitPrice: 380, currentStock: 12, minStockAlert: 20, warehouseLocation: 'F-01' } }), // Below alert
    prisma.product.create({ data: { name: 'Welding Rod 3.15mm (5kg)', sku: 'WLD-ROD-315', category: 'Welding', unitPrice: 1200, currentStock: 60, minStockAlert: 20, warehouseLocation: 'G-04' } }),
    prisma.product.create({ data: { name: 'Motor Pump 0.5 HP', sku: 'PMP-05HP', category: 'Pumps', unitPrice: 3800, currentStock: 22, minStockAlert: 10, warehouseLocation: 'H-09' } }),
    prisma.product.create({ data: { name: 'Rubber Gasket 2 inch', sku: 'GASK-RUB-2', category: 'Plumbing', unitPrice: 45, currentStock: 350, minStockAlert: 100, warehouseLocation: 'B-06' } }),
    prisma.product.create({ data: { name: 'Digital Multimeter', sku: 'INST-DMM-01', category: 'Instruments', unitPrice: 1850, currentStock: 7, minStockAlert: 10, warehouseLocation: 'I-03' } }), // Below alert
    prisma.product.create({ data: { name: 'HDPE Elbow 90 degree 63mm', sku: 'HDPE-ELB-63', category: 'Plumbing', unitPrice: 125, currentStock: 180, minStockAlert: 40, warehouseLocation: 'B-15' } }),
    prisma.product.create({ data: { name: 'Control Panel Box 400x300', sku: 'CTRL-BOX-43', category: 'Electrical', unitPrice: 2200, currentStock: 15, minStockAlert: 8, warehouseLocation: 'A-20' } }),
    prisma.product.create({ data: { name: 'V-Belt B Section 60"', sku: 'VBLT-B-60', category: 'Mechanical', unitPrice: 340, currentStock: 55, minStockAlert: 15, warehouseLocation: 'E-12' } }),
  ]);
  const [fan, pvcPipe, bolt, ledTube, cableTray, hydraulicJack, bearing, helmet, weldingRod, motorPump] = products;
  console.log(`  ✓ Created ${products.length} products (${products.filter(p => p.currentStock <= p.minStockAlert).length} below min stock alert)`);

  // ─── Customers ─────────────────────────────────────────────────────────────
  console.log('  Creating customers...');
  const customers = await Promise.all([
    prisma.customer.create({ data: { name: 'Rajesh Sharma', mobile: '9876543210', email: 'rajesh@sharmaindustries.com', businessName: 'Sharma Industries Pvt Ltd', gstNumber: '29AABCU9603R1ZX', customerType: CustomerType.WHOLESALE, address: '45 Industrial Area, Phase 2, Bengaluru 560058', status: CustomerStatus.ACTIVE } }),
    prisma.customer.create({ data: { name: 'Priya Nair', mobile: '8765432109', email: 'priya@naircontracts.com', businessName: 'Nair Contracts & Supply', gstNumber: '32AABCN8821K2ZM', customerType: CustomerType.DISTRIBUTOR, address: '12 Commerce Road, Ernakulam, Kerala 682001', status: CustomerStatus.ACTIVE, followUpDate: new Date('2026-08-15') } }),
    prisma.customer.create({ data: { name: 'Amit Patel', mobile: '7654321098', email: 'amit@patelhardware.in', businessName: 'Patel Hardware Store', gstNumber: '24AABCP4521J3ZK', customerType: CustomerType.RETAIL, address: '8 Gandhi Nagar, Surat, Gujarat 395009', status: CustomerStatus.ACTIVE } }),
    prisma.customer.create({ data: { name: 'Sunita Verma', mobile: '9543210987', email: 'sunita@vermatools.com', businessName: 'Verma Tools & Equipment', customerType: CustomerType.WHOLESALE, address: '67 Industrial Estate, Jaipur, Rajasthan 302013', status: CustomerStatus.LEAD, followUpDate: new Date('2026-08-12') } }),
    prisma.customer.create({ data: { name: 'Mohammed Irfan', mobile: '8432109876', email: 'irfan@hydindustrial.com', businessName: 'Hyd Industrial Supplies', gstNumber: '36AABCH7734P1ZN', customerType: CustomerType.DISTRIBUTOR, address: '234 Uppal Ring Road, Hyderabad, Telangana 500039', status: CustomerStatus.ACTIVE } }),
    prisma.customer.create({ data: { name: 'Lakshmi Devi', mobile: '7321098765', email: 'lakshmi@devielectricals.com', businessName: 'Devi Electricals', customerType: CustomerType.RETAIL, address: '5 T. Nagar, Chennai, Tamil Nadu 600017', status: CustomerStatus.INACTIVE } }),
    prisma.customer.create({ data: { name: 'Sandeep Kumar', mobile: '9210987654', email: 'sandeep@kumarengg.com', businessName: 'Kumar Engineering Works', gstNumber: '07AABCK5612L4ZP', customerType: CustomerType.WHOLESALE, address: '89 Naraina Industrial Area, New Delhi 110028', status: CustomerStatus.LEAD, followUpDate: new Date('2026-08-20') } }),
    prisma.customer.create({ data: { name: 'Rekha Singh', mobile: '8109876543', email: null, businessName: 'Singh Construction Co', customerType: CustomerType.DISTRIBUTOR, address: 'Plot 45, Sector 22, Noida, UP 201301', status: CustomerStatus.ACTIVE } }),
    prisma.customer.create({ data: { name: 'Vijay Reddy', mobile: '7098765432', email: 'vijay@reddymachinery.in', businessName: 'Reddy Machinery Traders', gstNumber: '37AABCR3391M5ZQ', customerType: CustomerType.WHOLESALE, address: '12 Auto Nagar, Vijayawada, AP 520007', status: CustomerStatus.LEAD } }),
    prisma.customer.create({ data: { name: 'Anita Joshi', mobile: '9987654321', email: 'anita@joshiplumbers.com', businessName: 'Joshi Plumbing Solutions', gstNumber: '27AABCJ8842N6ZR', customerType: CustomerType.RETAIL, address: '33 Shivaji Nagar, Pune, Maharashtra 411005', status: CustomerStatus.ACTIVE } }),
  ]);
  const [rajesh, priya, amit, sunita, irfan] = customers;
  console.log(`  ✓ Created ${customers.length} customers`);

  // ─── Customer Notes ────────────────────────────────────────────────────────
  console.log('  Creating customer notes...');
  await prisma.customerNote.createMany({
    data: [
      { customerId: priya.id, note: 'Called to discuss Q3 order. Interested in bulk pricing for industrial fans and cable trays. Will send quotation.', authorId: sales.id },
      { customerId: priya.id, note: 'Sent quotation via email. Waiting for approval from their procurement team. Follow up on 15th Aug.', authorId: sales.id },
      { customerId: sunita.id, note: 'First contact made via LinkedIn. They need welding supplies and safety equipment. Warm lead — visited their facility.', authorId: admin.id },
      { customerId: rajesh.id, note: 'Negotiated payment terms. Net-30 days approved. Primary contact is Rajesh Sharma, GM.', authorId: admin.id },
    ],
  });
  console.log('  ✓ Created customer notes');

  // ─── Stock Movements (initial IN movements) ────────────────────────────────
  console.log('  Creating initial stock movements...');
  const stockMoveData = products.slice(0, 5).map((p) => ({
    productId: p.id,
    quantityChanged: p.currentStock,
    movementType: MovementType.IN,
    reason: 'Initial inventory setup',
    createdById: warehouse.id,
  }));
  await prisma.stockMovement.createMany({ data: stockMoveData });
  console.log('  ✓ Created initial stock movements');

  // ─── Challans ──────────────────────────────────────────────────────────────
  console.log('  Creating challans...');

  // Challan 1: DRAFT
  const challan1 = await prisma.challan.create({
    data: {
      challanNumber: 'CH-2026-00001',
      customerId: rajesh.id,
      status: ChallanStatus.DRAFT,
      totalQuantity: 30,
      createdById: sales.id,
      items: {
        create: [
          {
            productId: fan.id,
            quantity: 10,
            lineTotal: 45000,
            productSnapshot: { name: fan.name, sku: fan.sku, unitPrice: fan.unitPrice.toString(), category: fan.category },
          },
          {
            productId: cableTray.id,
            quantity: 20,
            lineTotal: 13000,
            productSnapshot: { name: cableTray.name, sku: cableTray.sku, unitPrice: cableTray.unitPrice.toString(), category: cableTray.category },
          },
        ],
      },
    },
  });

  // Challan 2: CONFIRMED (manually reduce stock to simulate)
  await prisma.product.update({ where: { id: bearing.id }, data: { currentStock: { decrement: 50 } } });
  await prisma.product.update({ where: { id: weldingRod.id }, data: { currentStock: { decrement: 20 } } });

  const challan2 = await prisma.challan.create({
    data: {
      challanNumber: 'CH-2026-00002',
      customerId: priya.id,
      status: ChallanStatus.CONFIRMED,
      totalQuantity: 70,
      createdById: sales.id,
      items: {
        create: [
          {
            productId: bearing.id,
            quantity: 50,
            lineTotal: 11000,
            productSnapshot: { name: bearing.name, sku: bearing.sku, unitPrice: bearing.unitPrice.toString(), category: bearing.category },
          },
          {
            productId: weldingRod.id,
            quantity: 20,
            lineTotal: 24000,
            productSnapshot: { name: weldingRod.name, sku: weldingRod.sku, unitPrice: weldingRod.unitPrice.toString(), category: weldingRod.category },
          },
        ],
      },
    },
  });

  await prisma.stockMovement.createMany({
    data: [
      { productId: bearing.id, quantityChanged: -50, movementType: MovementType.OUT, reason: `Challan CH-2026-00002 confirmed`, createdById: sales.id },
      { productId: weldingRod.id, quantityChanged: -20, movementType: MovementType.OUT, reason: `Challan CH-2026-00002 confirmed`, createdById: sales.id },
    ],
  });

  // Challan 3: CANCELLED — with stock restored
  await prisma.product.update({ where: { id: motorPump.id }, data: { currentStock: { decrement: 5 } } });
  const challan3 = await prisma.challan.create({
    data: {
      challanNumber: 'CH-2026-00003',
      customerId: amit.id,
      status: ChallanStatus.CANCELLED,
      totalQuantity: 5,
      createdById: admin.id,
      items: {
        create: [
          {
            productId: motorPump.id,
            quantity: 5,
            lineTotal: 19000,
            productSnapshot: { name: motorPump.name, sku: motorPump.sku, unitPrice: motorPump.unitPrice.toString(), category: motorPump.category },
          },
        ],
      },
    },
  });
  // Restore stock since it was cancelled
  await prisma.product.update({ where: { id: motorPump.id }, data: { currentStock: { increment: 5 } } });
  await prisma.stockMovement.createMany({
    data: [
      { productId: motorPump.id, quantityChanged: -5, movementType: MovementType.OUT, reason: 'Challan CH-2026-00003 confirmed', createdById: admin.id },
      { productId: motorPump.id, quantityChanged: 5, movementType: MovementType.IN, reason: 'Challan CH-2026-00003 cancelled', createdById: admin.id },
    ],
  });

  console.log('  ✓ Created 3 challans (DRAFT, CONFIRMED, CANCELLED)');

  console.log('\n✅ Seeding complete!\n');
  console.log('─────────────────────────────────────────────');
  console.log('Test Credentials:');
  console.log('  Admin    → admin@erp.local     / Admin@123');
  console.log('  Sales    → sales@erp.local     / Sales@123');
  console.log('  Warehouse→ warehouse@erp.local / Warehouse@123');
  console.log('  Accounts → accounts@erp.local  / Accounts@123');
  console.log('─────────────────────────────────────────────');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
