"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LuShield } from "react-icons/lu";
import { CiMail } from "react-icons/ci";
import { CiUser } from "react-icons/ci";
import { CiPhone } from "react-icons/ci";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

const SignupPage = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pin, setPin] = useState(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", ""]);
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleDigitChange = (
    index: number,
    rawValue: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
  ) => {
    const digit = rawValue.replace(/\D/g, "").slice(-1);
    setter((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 3) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
  ) => {
    if (e.key === "Backspace") {
      setter((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      if (index > 0) {
        refs.current[index - 1]?.focus();
      }
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhoneNumber = phoneNumber.trim();
    const pinString = pin.join("");
    const confirmPinString = confirmPin.join("");

    if (
      !trimmedName ||
      !trimmedEmail ||
      !trimmedPhoneNumber ||
      pinString.length < 4 ||
      confirmPinString.length < 4
    ) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (pinString !== confirmPinString) {
      setErrorMessage("PIN and Confirm PIN do not match.");
      return;
    }

    setIsSubmitting(true);

    const { data: existingUser, error: existingUserError } = await supabase.rpc(
      "check_phone_exists",
      { input_phone: trimmedPhoneNumber },
    );

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
        phone_number: trimmedPhoneNumber,
        pin_hash: pinString,
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

  const pinInputClass =
    "w-14 h-14 border border-gray-300 rounded-2xl text-center text-xl outline-none focus:border-blue-500 text-gray-800";

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
            {errorMessage && (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">
                {errorMessage}
              </p>
            )}

            <div>
              <h2 className="text-2xl font-semibold text-black">
                Create Account
              </h2>
              <p className="text-sm text-gray-600 pb-4">
                Sign up to stay safe with SafeAlert Guardian
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
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Amara Johnson"
                  className="w-full ml-3 outline-none text-gray-600"
                />
              </div>
            </div>

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
                  onChange={(e) => setEmail(e.target.value)}
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
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full ml-3 outline-none text-gray-600"
                />
              </div>
            </div>

            {/* PIN */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-gray-700">
                  Create a 4-digit PIN
                </label>
                <button
                  type="button"
                  onClick={() => setShowPin((prev) => !prev)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  {showPin ? (
                    <>
                      <AiOutlineEyeInvisible size={16} /> Hide
                    </>
                  ) : (
                    <>
                      <AiOutlineEye size={16} /> Show
                    </>
                  )}
                </button>
              </div>
              <div className="flex gap-3">
                {pin.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      pinRefs.current[index] = el;
                    }}
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) =>
                      handleDigitChange(index, e.target.value, setPin, pinRefs)
                    }
                    onKeyDown={(e) =>
                      handleDigitKeyDown(index, e, setPin, pinRefs)
                    }
                    className={pinInputClass}
                  />
                ))}
              </div>
            </div>

            {/* Confirm PIN */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-gray-700">
                  Confirm PIN
                </label>
                <button
                  type="button"
                  onClick={() => setShowConfirmPin((prev) => !prev)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPin ? (
                    <>
                      <AiOutlineEyeInvisible size={16} /> Hide
                    </>
                  ) : (
                    <>
                      <AiOutlineEye size={16} /> Show
                    </>
                  )}
                </button>
              </div>
              <div className="flex gap-3">
                {confirmPin.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      confirmPinRefs.current[index] = el;
                    }}
                    type={showConfirmPin ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) =>
                      handleDigitChange(
                        index,
                        e.target.value,
                        setConfirmPin,
                        confirmPinRefs,
                      )
                    }
                    onKeyDown={(e) =>
                      handleDigitKeyDown(
                        index,
                        e,
                        setConfirmPin,
                        confirmPinRefs,
                      )
                    }
                    className={pinInputClass}
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

export default SignupPage;
