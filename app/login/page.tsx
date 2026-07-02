"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dispatch,
  FormEvent,
  KeyboardEvent,
  MutableRefObject,
  SetStateAction,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { LuShield } from "react-icons/lu";
import { CiPhone } from "react-icons/ci";

type UserRecord = {
  id: string | number;
  name: string | null;
  email: string | null;
  phone_number: string;
};
const PIN_LENGTH = 4;

const LoginPage = () => {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pinDigits, setPinDigits] = useState<string[]>(
    Array(PIN_LENGTH).fill(""),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const pinInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const updatePinDigit = (
    index: number,
    value: string,
    setDigits: Dispatch<SetStateAction<string[]>>,
    inputRefs: MutableRefObject<Array<HTMLInputElement | null>>,
  ) => {
    const sanitizedDigit = value.replace(/\D/g, "").slice(-1);

    setDigits((previousDigits) => {
      const nextDigits = [...previousDigits];
      nextDigits[index] = sanitizedDigit;
      return nextDigits;
    });

    if (sanitizedDigit && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
    digits: string[],
    inputRefs: MutableRefObject<Array<HTMLInputElement | null>>,
  ) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const createSession = async (user: UserRecord) => {
    const response = await fetch("/api/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: user.id,
        name: user.name ?? "",
        email: user.email ?? "",
        phoneNumber: user.phone_number,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create session.");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const trimmedPhoneNumber = phoneNumber.trim();
    const pin = pinDigits.join("");

    if (!trimmedPhoneNumber || !pin) {
      setErrorMessage("Phone number and PIN are required.");
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setErrorMessage("PIN must be exactly 4 digits.");
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, phone_number")
      .eq("phone_number", trimmedPhoneNumber)
      .eq("pin_hash", pin)
      .maybeSingle<UserRecord>();

    if (error) {
      console.error(error);
      setErrorMessage("Unable to process login right now.");
      setIsSubmitting(false);
      return;
    }

    if (!data) {
      setErrorMessage("Invalid phone number or PIN.");
      setIsSubmitting(false);
      return;
    }

    try {
      await createSession(data);
    } catch (sessionError) {
      console.error(sessionError);
      setErrorMessage("Login succeeded, but session creation failed.");
      setIsSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <main className=" w-full">
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
                Welcome Back!
              </h2>
              <p className="text-sm text-gray-600 pb-4">
                Sign in to your SafeAlert Account
              </p>
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
                Enter your 4-digit PIN
              </label>

              <div className="flex gap-3">
                {Array.from({ length: PIN_LENGTH }).map((_, index) => (
                  <input
                    key={`pin-${index}`}
                    id={`pin-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={pinDigits[index]}
                    onChange={(event) =>
                      updatePinDigit(
                        index,
                        event.target.value,
                        setPinDigits,
                        pinInputRefs,
                      )
                    }
                    onKeyDown={(event) =>
                      handlePinKeyDown(event, index, pinDigits, pinInputRefs)
                    }
                    ref={(element) => {
                      pinInputRefs.current[index] = element;
                    }}
                    className="w-14 h-14 border text-black border-gray-300 rounded-2xl text-center text-xl outline-none focus:border-blue-500"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 rounded-2xl bg-red-600 p-2 text-white disabled:opacity-60 shadow-lg"
            >
              {isSubmitting ? "Logging in..." : "Login"}
            </button>

            <p className="mt-4 text-sm text-gray-600">
              Need an account?{" "}
              <Link
                href="/signin"
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

export default LoginPage;
