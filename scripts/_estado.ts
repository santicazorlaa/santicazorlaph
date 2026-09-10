import { db } from "../src/lib/db";
async function main() {
  const cols: any = await db.$queryRawUnsafe(
    `select column_name from information_schema.columns where table_name='Photo' and column_name in ('destacada','portfolioKey','ordenPortfolio')`,
  );
  const tabla: any = await db.$queryRawUnsafe(
    `select table_name from information_schema.tables where table_name='PortfolioPhoto'`,
  );
  const fallidas: any = await db.$queryRawUnsafe(
    `select migration_name, started_at, finished_at, logs from "_prisma_migrations" where finished_at is null`,
  );
  console.log("columnas viejas que quedan:", cols.map((c: any) => c.column_name));
  console.log("existe PortfolioPhoto:", tabla.length > 0);
  for (const f of fallidas) console.log("FALLIDA:", f.migration_name, "\n", String(f.logs).slice(0, 400));
}
main().finally(() => db.$disconnect());
