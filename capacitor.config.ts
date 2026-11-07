import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.safeguardian.app",
  appName: "SafeAlert Guardian",
  webDir: "public",
  server: {
    // When deploying or testing live app, points to your live URL or dev server:
    url: process.env.NEXT_PUBLIC_APP_URL || "https://safeguardianapp.netlify.app",
    cleartext: true,
    androidScheme: "https",
  },
  plugins: {
    BackgroundGeolocation: {
      // Configuration for background location tracking
    },
  },
};

export default config;

