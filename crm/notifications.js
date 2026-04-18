// When ready: npm install twilio, fill .env, and uncomment the client block below.
//
// import twilio from "twilio";
// const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function sendSms({ toPhone, message }) {
  // return client.messages.create({
  //   body: message,
  //   from: process.env.TWILIO_FROM_NUMBER,
  //   to: toPhone,
  // });
  console.log(`[SMS PLACEHOLDER] To: ${toPhone} | ${message}`);
  return { success: true, placeholder: true };
}

export async function notifyStatusChange({ job, customer }) {
  const message = `Hi ${customer.name}, your bike repair status is now: ${job.status}. Expected: ${job.expectedDate ?? "TBD"}.`;
  return sendSms({ toPhone: customer.phone, message });
}

export async function notifyJobReady({ job, customer }) {
  const message = `Hi ${customer.name}, your bike is ready for pickup!`;
  return sendSms({ toPhone: customer.phone, message });
}
