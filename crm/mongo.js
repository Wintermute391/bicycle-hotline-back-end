import { randomUUID } from "crypto";
import { getDb } from "../shared/mongo.js";

const CUSTOMERS = "customers";
const JOBS = "jobs";
const BIKES = "bikes";

const VALID_STATUSES = new Set([
  "in_queue",
  "waiting_for_parts",
  "in_progress",
  "completed",
  "picked_up",
]);

// ── Customers ────────────────────────────────────────────────────────────────

export async function listCustomers() {
  return getDb().collection(CUSTOMERS).find({}).sort({ name: 1 }).toArray();
}

export async function getCustomerById(customerId) {
  return getDb().collection(CUSTOMERS).findOne({ _id: customerId });
}

export async function createCustomer({ name, phone, email }) {
  const customer = {
    _id: randomUUID(),
    name: String(name || "").trim(),
    phone: String(phone || "").trim(),
    email: String(email || "").trim().toLowerCase(),
    createdAt: new Date().toISOString(),
  };
  await getDb().collection(CUSTOMERS).insertOne(customer);
  return customer;
}

export async function updateCustomer({ customerId, name, phone, email }) {
  const update = {};
  if (name !== undefined) update.name = String(name).trim();
  if (phone !== undefined) update.phone = String(phone).trim();
  if (email !== undefined) update.email = String(email).trim().toLowerCase();

  await getDb().collection(CUSTOMERS).updateOne({ _id: customerId }, { $set: update });
  return getCustomerById(customerId);
}

export async function deleteCustomer({ customerId }) {
  const activeJob = await getDb()
    .collection(JOBS)
    .findOne({ customerId, status: { $nin: ["completed", "picked_up"] } });

  if (activeJob) throw new Error("Cannot delete customer with active jobs.");

  await getDb().collection(CUSTOMERS).deleteOne({ _id: customerId });
  return customerId;
}

// ── Bikes ─────────────────────────────────────────────────────────────────────

export async function listBikes() {
  return getDb().collection(BIKES).find({}).sort({ make: 1, model: 1 }).toArray();
}

export async function getBikeById(bikeId) {
  return getDb().collection(BIKES).findOne({ _id: bikeId });
}

export async function createBike({ customerId, make, model, color, description }) {
  const bike = {
    _id: randomUUID(),
    customerId: customerId || null,
    make: String(make || "").trim(),
    model: String(model || "").trim(),
    color: String(color || "").trim(),
    description: String(description || "").trim(),
    createdAt: new Date().toISOString(),
  };
  await getDb().collection(BIKES).insertOne(bike);
  return bike;
}

export async function updateBike({ bikeId, customerId, make, model, color, description }) {
  const update = {};
  if (customerId !== undefined) update.customerId = customerId || null;
  if (make !== undefined) update.make = String(make).trim();
  if (model !== undefined) update.model = String(model).trim();
  if (color !== undefined) update.color = String(color).trim();
  if (description !== undefined) update.description = String(description).trim();

  await getDb().collection(BIKES).updateOne({ _id: bikeId }, { $set: update });
  return getBikeById(bikeId);
}

export async function deleteBike({ bikeId }) {
  await getDb().collection(BIKES).deleteOne({ _id: bikeId });
  return bikeId;
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

function normalizeExpenses(expenses = []) {
  return expenses.map((e) => ({
    id: e.id || randomUUID(),
    description: String(e.description || "").trim(),
    price: Number(e.price) || 0,
  }));
}

async function getMaxQueueOrder() {
  const result = await getDb()
    .collection(JOBS)
    .find({})
    .sort({ queueOrder: -1 })
    .limit(1)
    .toArray();
  return result.length > 0 ? result[0].queueOrder : -1;
}

export async function listJobs({ sort = "queue" } = {}) {
  let sortSpec;
  if (sort === "startDate") sortSpec = { startDate: 1 };
  else if (sort === "expectedDate") sortSpec = { expectedDate: 1 };
  else sortSpec = { queueOrder: 1 };

  return getDb().collection(JOBS).find({}).sort(sortSpec).toArray();
}

export async function getJobById(jobId) {
  return getDb().collection(JOBS).findOne({ _id: jobId });
}

export async function createJob({ customerId, bikeId, description, startDate, expectedDate }) {
  const maxOrder = await getMaxQueueOrder();
  const job = {
    _id: randomUUID(),
    customerId,
    bikeId: bikeId || null,
    description: String(description || "").trim(),
    startDate: startDate || new Date().toISOString().slice(0, 10),
    expectedDate: expectedDate || null,
    status: "in_queue",
    queueOrder: maxOrder + 1,
    expenses: [],
    updatedAt: new Date().toISOString(),
  };
  await getDb().collection(JOBS).insertOne(job);
  return job;
}

export async function updateJob({ jobId, description, startDate, expectedDate, bikeId, expenses }) {
  const update = { updatedAt: new Date().toISOString() };
  if (description !== undefined) update.description = String(description).trim();
  if (startDate !== undefined) update.startDate = startDate;
  if (expectedDate !== undefined) update.expectedDate = expectedDate;
  if (bikeId !== undefined) update.bikeId = bikeId || null;
  if (expenses !== undefined) update.expenses = normalizeExpenses(expenses);

  await getDb().collection(JOBS).updateOne({ _id: jobId }, { $set: update });
  return getJobById(jobId);
}

export async function updateJobStatus({ jobId, status }) {
  if (!VALID_STATUSES.has(status)) throw new Error(`Invalid status: ${status}`);
  await getDb()
    .collection(JOBS)
    .updateOne({ _id: jobId }, { $set: { status, updatedAt: new Date().toISOString() } });
  return getJobById(jobId);
}

export async function reorderJob({ jobId, direction }) {
  const jobs = await listJobs({ sort: "queue" });
  const currentIndex = jobs.findIndex((j) => j._id === jobId);

  if (currentIndex === -1) throw new Error("Job not found.");

  const offset = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  if (!offset) throw new Error("Direction must be 'up' or 'down'.");

  const nextIndex = currentIndex + offset;
  if (nextIndex < 0 || nextIndex >= jobs.length) return jobs;

  const target = jobs[currentIndex];
  const neighbor = jobs[nextIndex];
  const db = getDb();

  await Promise.all([
    db.collection(JOBS).updateOne({ _id: target._id }, { $set: { queueOrder: neighbor.queueOrder } }),
    db.collection(JOBS).updateOne({ _id: neighbor._id }, { $set: { queueOrder: target.queueOrder } }),
  ]);

  return listJobs({ sort: "queue" });
}

export async function deleteJob({ jobId }) {
  await getDb().collection(JOBS).deleteOne({ _id: jobId });
  return jobId;
}
