import app from "./app";
// import { prisma } from "./models/prisma";

const PORT = process.env.PORT || 5500;

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  try {
    // await prisma.$connect();
    // console.log("Database connected.");
  } catch (error: any) {
    console.error("Failed:", error);
    process.exit(1);
  }
});
