export default async () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://safeguardianapp.netlify.app";
  try {
    const res = await fetch(`${appUrl}/api/check-in/cron`, {
      method: "POST",
    });
    const data = await res.json();
    console.log("[Netlify Cron] Check-in sweep executed:", data);
  } catch (err) {
    console.error("[Netlify Cron] Failed to ping check-in cron:", err);
  }
};

export const config = {
  schedule: "* * * * *", // Runs every minute
};

