"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LuShield } from "react-icons/lu";
import { CiMail } from "react-icons/ci";
import { CiUser } from "react-icons/ci";
import { CiPhone } from "react-icons/ci";

const Testing = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhoneNumber = phoneNumber.trim();

    if (
      !trimmedName ||
      !trimmedEmail ||
      !trimmedPhoneNumber ||
      !pin ||
      !confirmPin
    ) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setErrorMessage("PIN must be exactly 4 digits.");
      return;
    }

    if (pin !== confirmPin) {
      setErrorMessage("PIN and Confirm PIN do not match.");
      return;
    }

    setIsSubmitting(true);

    const { data: existingUser, error: existingUserError } = await supabase
      .from("users")
      .select("id")
      .eq("phoneNumber", trimmedPhoneNumber)
      .maybeSingle();

    if (existingUserError) {
      console.error(existingUserError);
      setErrorMessage("Unable to validate existing account right now.");
      setIsSubmitting(false);
      return;
    }

    if (existingUser) {
      setErrorMessage("An account with this phone number already exists.");
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from("users").insert([
      {
        name: trimmedName,
        email: trimmedEmail,
        phoneNumber: trimmedPhoneNumber,
        pin,
      },
    ]);

    if (error) {
      console.error(error);
      setErrorMessage("Unable to create your account.");
      setIsSubmitting(false);
      return;
    }

    router.push("/login");
    router.refresh();
  };

  return (
    <main className="w-full">
      <div
        className="w-full h-60 bg-red-600 flex flex-col justify-center items-center"
        style={{
          backgroundImage:
            "repeating-radial-gradient(circle, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 2px, transparent 2px, transparent 30px)",
        }}
      >
        <div className="mb-4 rounded-2xl bg-red-500/80 p-5 shadow-lg">
          <LuShield className="text-5xl text-white" />
        </div>

        <h1 className="text-2xl font-bold text-white pt-1">
          SafeAlert Guardian
        </h1>
        <span>Your Personal Safety Companion</span>
      </div>

      <div className="bg-slate-100 w-full">
        <div className="w-full flex justify-center">
          <form
            onSubmit={handleSubmit}
            className="bg-white p-8 rounded-md shadow-lg"
          >
            {errorMessage ? (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <div>
              <h2 className="text-2xl font-semibold text-black">
                Create Account
              </h2>
              <p className="text-sm text-gray-600 pb-4">
                Sign up to stay safe with SSafeAlert Guardian
              </p>
            </div>

            <div className="mb-5">
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Full Name
              </label>

              <div className="flex items-center border border-gray-300 rounded-2xl px-4 h-14">
                <CiUser size={18} className="text-gray-400" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Amara Johnson"
                  className="w-full ml-3 outline-none text-gray-600"
                />
              </div>
            </div>
            {/* <label htmlFor="name" className="text-sm text-black">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black"
                placeholder="Enter your full name"
              />
            </div> */}

            <div className="mb-5">
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Email Address
              </label>

              <div className="flex items-center border border-gray-300 rounded-2xl px-4 h-14">
                <CiMail size={18} className="text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="amara@email.com"
                  className="w-full ml-3 outline-none text-gray-600"
                />
              </div>
            </div>

      
            <div className="mb-6">
              <label
                htmlFor="phoneNumber"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Phone Number
              </label>

              <div className="flex items-center border border-gray-300 rounded-2xl px-4 h-14">
                <CiPhone size={18} className="text-gray-400" />
                <input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full ml-3 outline-none text-gray-600"
                />
              </div>
            </div>

            <div className="mb-6">
              <label
                htmlFor="pin"
                className="block text-sm font-semibold text-gray-700 mb-3"
              >
                Create a 4-digit PIN
              </label>

              <div className="flex gap-3">
                {[1, 2, 3, 4].map((item) => (
                  <input
                    key={item}
                    id="pin"
                    type="password"
                    maxLength={1}
                    value={pin}
                    onChange={(event) => setPin(event.target.value)}
                    className="w-14 h-14 border border-gray-300 rounded-2xl text-center text-xl outline-none focus:border-blue-500"
                  />
                ))}
              </div>
            </div>
          

            <div>
              <label
                htmlFor="confirmPin"
                className="block text-sm font-semibold text-gray-700 mb-3"
              >
                Confirm PIN
              </label>

              <div className="flex gap-3">
                {[1, 2, 3, 4].map((item) => (
                  <input
                    key={item}
                    id="confirmPin"
                    type="password"
                    maxLength={1}
                    value={confirmPin}
                    onChange={(event) => setConfirmPin(event.target.value)}
                    className="w-14 h-14 border border-gray-300 rounded-2xl text-center text-xl outline-none focus:border-blue-500"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 rounded-2xl bg-red-600 p-2 text-white disabled:opacity-60 mt-4 shadow-lg"
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>

            <p className="mt-4 text-sm text-gray-600">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-red-600 underline"
              >
                Sign In
              </Link>
            </p>
          </form>
        </div>

        <div className="flex justify-center items-center gap-10 mt-4 pt-4 pb-4 border-t border-gray-100">
          <div className="flex flex-col items-center">
            <span className="text-xl">🔒</span>
            <p className="text-xs text-gray-500 mt-1">Encrypted</p>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-xl">📍</span>
            <p className="text-xs text-gray-500 mt-1">GPS-Enabled</p>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-xl">🚨</span>
            <p className="text-xs text-gray-500 mt-1">24/7 Alert</p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Testing;
