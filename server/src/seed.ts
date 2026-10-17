import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const sampleProducts = [
  { name: "Computer paper", category: "Finished Good", sku: "FG758949", incoming: 45, stock: 463, unitPrice: 56.99, lowStockThreshold: 50 },
  { name: "Linen paper", category: "Raw Material", sku: "FH85T940", incoming: 56, stock: 34, unitPrice: 167.99, lowStockThreshold: 40 },
  { name: "Smooth cardstock", category: "Finished Good", sku: "W748939", incoming: 123, stock: 0, unitPrice: 747.99, lowStockThreshold: 10 },
  { name: "Marble cardstock", category: "Raw Material", sku: "GFD7890", incoming: 35, stock: 132, unitPrice: 34.76, lowStockThreshold: 20 },
  { name: "Canvas cardstock", category: "Finished Good", sku: "K849035", incoming: 149, stock: 86, unitPrice: 345.45, lowStockThreshold: 15 },
  { name: "ProVisionary Solutions", category: "Raw Material", sku: "L748395", incoming: 138, stock: 12, unitPrice: 34, lowStockThreshold: 20 },
  { name: "ProdigyPlus Professional", category: "Raw Material", sku: "7383R000", incoming: 36, stock: 246, unitPrice: 134, lowStockThreshold: 25 },
  { name: "VanguardPro", category: "Raw Material", sku: "FG758950", incoming: 275, stock: 18, unitPrice: 234.76, lowStockThreshold: 20 },
  { name: "SerenitySphere", category: "Finished Good", sku: "HL000089", incoming: 264, stock: 264, unitPrice: 234.76, lowStockThreshold: 25 },
  { name: "Innovative Imaginings", category: "Finished Good", sku: "HL000090", incoming: 264, stock: 105, unitPrice: 89.5, lowStockThreshold: 20 },
  { name: "Studio ink set", category: "Raw Material", sku: "RM204812", incoming: 24, stock: 67, unitPrice: 18.5, lowStockThreshold: 10 },
  { name: "Premium sketchbook", category: "Finished Good", sku: "FG103092", incoming: 40, stock: 92, unitPrice: 24.99, lowStockThreshold: 15 },
];

try {
  const count = await prisma.product.count();
  if (count === 0) {
    await prisma.product.createMany({ data: sampleProducts });
    console.log(`Added ${sampleProducts.length} sample inventory products.`);
  } else {
    console.log("Seed skipped: inventory already contains products.");
  }
} finally {
  await prisma.$disconnect();
}
