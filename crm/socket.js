import {
  createCustomer,
  deleteCustomer,
  deleteJob,
  getCustomerById,
  listCustomers,
  listJobs,
  createJob,
  reorderJob,
  updateCustomer,
  updateJob,
  updateJobStatus,
} from "./mongo.js";
import { notifyStatusChange } from "./notifications.js";

function emitResponse(socket, eventName, correlationId, response) {
  socket.emit(`${eventName}:response`, { correlationId, ...response });
}

async function handle(socket, io, eventName, correlationId, fn) {
  try {
    const data = await fn();
    emitResponse(socket, eventName, correlationId, { ok: true, data });
  } catch (err) {
    console.error(`[crm-socket] error in ${eventName}`, err.message);
    emitResponse(socket, eventName, correlationId, { ok: false, error: err.message });
  }
}

export function registerCrmSocketHandlers(io, socket) {
  // ── Customers ──────────────────────────────────────────────────────────────

  socket.on("crm:customer:list", async ({ correlationId } = {}) => {
    await handle(socket, io, "crm:customer:list", correlationId, async () => {
      const customers = await listCustomers();
      return { customers };
    });
  });

  socket.on("crm:customer:create", async ({ correlationId, name, phone, email } = {}) => {
    await handle(socket, io, "crm:customer:create", correlationId, async () => {
      const customer = await createCustomer({ name, phone, email });
      io.emit("crm:customerChanged", { customer });
      return { customer };
    });
  });

  socket.on(
    "crm:customer:update",
    async ({ correlationId, customerId, name, phone, email } = {}) => {
      await handle(socket, io, "crm:customer:update", correlationId, async () => {
        const customer = await updateCustomer({ customerId, name, phone, email });
        io.emit("crm:customerChanged", { customer });
        return { customer };
      });
    }
  );

  socket.on("crm:customer:delete", async ({ correlationId, customerId } = {}) => {
    await handle(socket, io, "crm:customer:delete", correlationId, async () => {
      await deleteCustomer({ customerId });
      io.emit("crm:customerRemoved", { customerId });
      return { customerId };
    });
  });

  // ── Jobs ───────────────────────────────────────────────────────────────────

  socket.on("crm:job:list", async ({ correlationId, sort } = {}) => {
    await handle(socket, io, "crm:job:list", correlationId, async () => {
      const jobs = await listJobs({ sort });
      return { jobs };
    });
  });

  socket.on(
    "crm:job:create",
    async ({ correlationId, customerId, description, startDate, expectedDate } = {}) => {
      await handle(socket, io, "crm:job:create", correlationId, async () => {
        const job = await createJob({ customerId, description, startDate, expectedDate });
        io.emit("crm:jobChanged", { job });
        return { job };
      });
    }
  );

  socket.on("crm:job:update", async ({ correlationId, jobId, ...fields } = {}) => {
    await handle(socket, io, "crm:job:update", correlationId, async () => {
      const job = await updateJob({ jobId, ...fields });
      io.emit("crm:jobChanged", { job });
      return { job };
    });
  });

  socket.on("crm:job:status", async ({ correlationId, jobId, status } = {}) => {
    await handle(socket, io, "crm:job:status", correlationId, async () => {
      const job = await updateJobStatus({ jobId, status });
      io.emit("crm:jobChanged", { job });

      const customer = await getCustomerById(job.customerId);
      if (customer?.phone) {
        notifyStatusChange({ job, customer }).catch((err) =>
          console.error("[crm-socket] notification failed", err.message)
        );
      }

      return { job };
    });
  });

  socket.on("crm:job:reorder", async ({ correlationId, jobId, direction } = {}) => {
    await handle(socket, io, "crm:job:reorder", correlationId, async () => {
      const jobs = await reorderJob({ jobId, direction });
      io.emit("crm:queueChanged", { jobs });
      return { jobs };
    });
  });

  socket.on("crm:job:delete", async ({ correlationId, jobId } = {}) => {
    await handle(socket, io, "crm:job:delete", correlationId, async () => {
      await deleteJob({ jobId });
      io.emit("crm:jobRemoved", { jobId });
      return { jobId };
    });
  });
}
