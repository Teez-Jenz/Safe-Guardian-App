export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackgroundCheckInWorker } = await import("@/lib/checkInWorker");
    startBackgroundCheckInWorker();
  }
}

