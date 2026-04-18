import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { listCustomers, listBikes, listJobs } from "./mongo.js";

const BACKUP_DIR = join(process.cwd(), "backups");

function formatTimestamp(date = new Date()) {
  return date.toISOString().replace(/:/g, "-").replace(/\..+/, "");
}

export async function createBackup() {
  const [customers, bikes, jobs] = await Promise.all([
    listCustomers(),
    listBikes(),
    listJobs({ sort: "queue" }),
  ]);

  const payload = {
    createdAt: new Date().toISOString(),
    customers,
    bikes,
    jobs,
  };

  await mkdir(BACKUP_DIR, { recursive: true });

  const filename = `${formatTimestamp()}.json`;
  await writeFile(join(BACKUP_DIR, filename), JSON.stringify(payload, null, 2), "utf8");

  console.log(`[backup] saved ${filename} (${customers.length} customers, ${bikes.length} bikes, ${jobs.length} jobs)`);

  return { filename, payload };
}
