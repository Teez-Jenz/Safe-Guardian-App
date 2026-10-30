// "use client";

// import { useEffect, useState, useRef } from "react";
// import { Clock, ChevronDown, ShieldAlert, PhoneCall, Mail, MapPin, CheckCircle2, AlertTriangle } from "lucide-react";
// import { useSafety } from "../context/SafetyContext";

// const ACTIVITIES = [
//   "Walking",
//   "Running",
//   "Cycling",
//   "Driving",
//   "Hiking",
//   "Public transit",
//   "Other",
// ];

// const DURATIONS = [
//   { label: "1 minute", minutes: 1 },
//   { label: "2 minutes", minutes: 2 },
//   { label: "3 minutes", minutes: 3 },
//   { label: "5 minutes", minutes: 5 },
//   { label: "10 minutes", minutes: 10 },
//   { label: "15 minutes", minutes: 15 },
//   { label: "30 minutes", minutes: 30 },
//   { label: "45 minutes", minutes: 45 },
//   { label: "1 hour", minutes: 60 },
//   { label: "1.5 hours", minutes: 90 },
//   { label: "2 hours", minutes: 120 },
// ];

// function SafetyCheckIn() {
//   const {
//     activeCheckIn,
//     startCheckIn,
//     stopCheckIn,
//     sosActive,
//     sosAlertResult,
//     triggerCheckInOverdue,
//   } = useSafety();

//   const [activity, setActivity] = useState("");
//   const [duration, setDuration] = useState(30);
//   const [submitting, setSubmitting] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [timeLeft, setTimeLeft] = useState(0);
//   const triggeredRef = useRef(false);

//   // Countdown timer logic
//   useEffect(() => {
//     if (!activeCheckIn) {
//       triggeredRef.current = false;
//       return;
//     }

//     const calculateTimeLeft = () => {
//       const startedTime = new Date(activeCheckIn.started_at).getTime();
//       const expectedDurationMs = activeCheckIn.expected_duration_minutes * 60 * 1000;
//       const endTime = startedTime + expectedDurationMs;
//       const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
//       setTimeLeft(remaining);

//       // Trigger overdue alert immediately if countdown expired and hasn't yet triggered
//       if (remaining <= 0 && activeCheckIn.status === "active" && !triggeredRef.current) {
//         triggeredRef.current = true;
//         triggerCheckInOverdue(activeCheckIn);
//       }
//     };

//     calculateTimeLeft();
//     const interval = setInterval(calculateTimeLeft, 1000);

//     return () => clearInterval(interval);
//   }, [activeCheckIn, triggerCheckInOverdue]);

//   async function handleStartCheckIn() {
//     if (!activity) {
//       setError("Pick an activity before starting.");
//       return;
//     }

//     setSubmitting(true);
//     setError(null);

//     try {
//       await startCheckIn(activity, duration);
//       setActivity("");
//       setDuration(30);
//     } catch (err: unknown) {
//       setError(err instanceof Error ? err.message : "Failed to start check-in.");
//     } finally {
//       setSubmitting(false);
//     }
//   }

//   const formatTime = (seconds: number) => {
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
//   };

//   if (activeCheckIn) {
//     const isOverdue = timeLeft === 0 || activeCheckIn.status === "missed";

//     return (
//       <div className="w-full max-w-2xl rounded-3xl bg-white p-6 md:p-8 shadow-sm ring-1 ring-gray-100 border border-gray-100 flex flex-col items-center">
//         <h1 className="text-xl font-bold text-gray-900 mb-1">Active Safety Check-In</h1>
//         <p className="text-sm text-gray-500 mb-6 text-center">
//           {isOverdue
//             ? "Your scheduled timer expired without a safety confirmation. Emergency alerts have been broadcast."
//             : "We are monitoring your safety. Check in before the timer expires to confirm you arrived safely."}
//         </p>

//         {/* Big Timer */}
//         <div
//           className={`text-6xl font-black mb-4 tracking-wider tabular-nums ${
//             isOverdue ? "text-red-600 animate-pulse" : "text-gray-900"
//           }`}
//         >
//           {formatTime(timeLeft)}
//         </div>

//         {/* Overdue Alert Banner & Actions */}
//         {isOverdue ? (
//           <div className="w-full mb-6 bg-red-50 border-2 border-red-500 rounded-2xl p-5 text-red-950 space-y-3">
//             <div className="flex items-center gap-2 text-red-700 font-bold text-base">
//               <ShieldAlert className="w-6 h-6 shrink-0 animate-bounce text-red-600" />
//               <span>🚨 MISSED CHECK-IN: EMERGENCY ALERT ACTIVATED</span>
//             </div>
//             <p className="text-xs text-red-800 leading-relaxed">
//               Your timer for <strong>{activeCheckIn.activity}</strong> expired. Automated phone calls are dialing your trusted contacts and high-priority emails with your GPS coordinates have been dispatched.
//             </p>

//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-red-200 text-xs">
//               <div className="flex items-center gap-2 bg-white/80 p-2.5 rounded-xl border border-red-200">
//                 <PhoneCall className="w-4 h-4 text-red-600 shrink-0" />
//                 <span>
//                   <strong>Phone Ring:</strong>{" "}
//                   {sosAlertResult?.calls
//                     ? `${sosAlertResult.calls.triggered} of ${sosAlertResult.calls.total} called`
//                     : "Dialing trusted contact phones..."}
//                 </span>
//               </div>
//               <div className="flex items-center gap-2 bg-white/80 p-2.5 rounded-xl border border-red-200">
//                 <Mail className="w-4 h-4 text-red-600 shrink-0" />
//                 <span>
//                   <strong>Email:</strong>{" "}
//                   {sosAlertResult?.emails
//                     ? `${sosAlertResult.emails.sent} sent with GPS`
//                     : "Delivering email notifications..."}
//                 </span>
//               </div>
//             </div>

//             {sosAlertResult?.location?.address && (
//               <div className="flex items-start gap-2 bg-white/80 p-2.5 rounded-xl border border-red-200 text-xs text-gray-700">
//                 <MapPin className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
//                 <span className="line-clamp-2">
//                   <strong>Dispatched Location:</strong> {sosAlertResult.location.address}
//                 </span>
//               </div>
//             )}

//             {sosAlertResult?.callError && (
//               <div className="p-2 rounded-lg bg-red-100 text-red-900 text-xs flex items-center gap-1.5">
//                 <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
//                 <span>Africa&apos;s Talking: {sosAlertResult.callError}</span>
//               </div>
//             )}

//             {sosAlertResult?.emailError && (
//               <div className="p-2 rounded-lg bg-red-100 text-red-900 text-xs flex items-center gap-1.5">
//                 <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
//                 <span>Brevo: {sosAlertResult.emailError}</span>
//               </div>
//             )}
//           </div>
//         ) : (
//           /* Normal Tracking indicator */
//           <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold px-3 py-1 bg-emerald-50 rounded-full mb-6">
//             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
//             <span>GPS Location Tracking Active</span>
//           </div>
//         )}

//         {/* Details Card */}
//         <div className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 mb-6 space-y-3">
//           <div className="flex justify-between text-sm">
//             <span className="text-gray-500">Activity Type</span>
//             <span className="font-semibold text-gray-900">{activeCheckIn.activity}</span>
//           </div>
//           <div className="flex justify-between text-sm">
//             <span className="text-gray-500">Expected Duration</span>
//             <span className="font-semibold text-gray-900">{activeCheckIn.expected_duration_minutes} minutes</span>
//           </div>
//           <div className="flex justify-between text-sm">
//             <span className="text-gray-500">Started At</span>
//             <span className="font-semibold text-gray-900">
//               {new Date(activeCheckIn.started_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
//             </span>
//           </div>
//           <div className="flex justify-between text-sm">
//             <span className="text-gray-500">Status</span>
//             <span
//               className={`font-semibold capitalize text-xs px-2.5 py-0.5 rounded-full border ${
//                 isOverdue
//                   ? "bg-red-100 text-red-800 border-red-200"
//                   : "bg-emerald-100 text-emerald-800 border-emerald-200"
//               }`}
//             >
//               {isOverdue ? "Overdue / Alert Dispatched" : activeCheckIn.status}
//             </span>
//           </div>
//         </div>

//         {/* Stop / Cancel button */}
//         <button
//           onClick={stopCheckIn}
//           className={`w-full py-4 rounded-xl font-bold transition shadow-md flex items-center justify-center gap-2 cursor-pointer ${
//             isOverdue
//               ? "bg-red-600 hover:bg-red-700 text-white shadow-red-200"
//               : "bg-gray-900 hover:bg-black text-white"
//           }`}
//         >
//           {isOverdue ? (
//             <>
//               <CheckCircle2 className="w-5 h-5 text-white" />
//               <span>I Am Safe (Cancel Emergency & Stop Check-In)</span>
//             </>
//           ) : (
//             <>
//               <Clock className="w-5 h-5" />
//               <span>I am Safe (Stop Check-In)</span>
//             </>
//           )}
//         </button>
//       </div>
//     );
//   }

//   return (
//     <div className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
//       <h1 className="text-lg font-semibold text-gray-900">Safety Check-In</h1>
//       <p className="mt-1 text-gray-500">
//         Set a timer for your activity. We&apos;ll alert your contacts if you
//         don&apos;t check in on time.
//       </p>

//       <div className="mt-6">
//         <label className="block text-sm font-semibold text-gray-900">
//           Activity
//         </label>
//         <div className="relative mt-2">
//           <select
//             value={activity}
//             onChange={(e) => setActivity(e.target.value)}
//             className="w-full appearance-none rounded-xl bg-gray-100 px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
//           >
//             <option value="" disabled>
//               Select activity...
//             </option>
//             {ACTIVITIES.map((a) => (
//               <option key={a} value={a}>
//                 {a}
//               </option>
//             ))}
//           </select>
//           <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
//         </div>
//       </div>

//       <div className="mt-5">
//         <label className="block text-sm font-semibold text-gray-900">
//           Expected Duration
//         </label>
//         <div className="relative mt-2">
//           <select
//             value={duration}
//             onChange={(e) => setDuration(Number(e.target.value))}
//             className="w-full appearance-none rounded-xl bg-gray-100 px-4 py-3 font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
//           >
//             {DURATIONS.map((d) => (
//               <option key={d.minutes} value={d.minutes}>
//                 {d.label}
//               </option>
//             ))}
//           </select>
//           <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
//         </div>
//       </div>

//       {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

//       <button
//         onClick={handleStartCheckIn}
//         disabled={submitting}
//         className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3 font-medium text-white transition hover:bg-gray-700 disabled:opacity-60 cursor-pointer"
//       >
//         <Clock className="h-4 w-4" />
//         {submitting ? "Starting…" : "Start Check-In"}
//       </button>
//     </div>
//   );
// }

// function HowItWorks() {
//   const steps = [
//     "Select your current activity",
//     "Set expected duration",
//     "We'll track your location",
//     "Check in when you arrive safely",
//     "If you don't check in, we'll alert your contacts",
//   ];

//   return (
//     <div className="relative w-full max-w-2xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
//       <h2 className="font-semibold text-gray-900">How It Works</h2>

//       <ol className="mt-4 space-y-3">
//         {steps.map((step, i) => (
//           <li key={i} className="flex gap-2 text-gray-600">
//             <span>{i + 1}.</span>
//             <span>{step}</span>
//           </li>
//         ))}
//       </ol>
//     </div>
//   );
// }

// export default function Page() {
//   return (
//     <main className="flex min-h-screen flex-col items-center gap-6 bg-gray-100 p-6">
//       <SafetyCheckIn />
//       <HowItWorks />
//     </main>
//   );
// }
