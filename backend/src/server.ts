import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/prisma.js";

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    await prisma.$connect();

    console.log("PostgreSQL connected successfully");

    app.listen(PORT, () => {
      console.log(` Stock Flow API running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);

    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
