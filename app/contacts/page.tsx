"use client";
import { supabase } from "@/lib/supabase";
import { GoPersonAdd } from "react-icons/go";
import { FormEvent, useEffect, useState } from "react";

type Contact = {
  name: string;
  email: string;
  phoneNumber: string;
  relationship: string;
};

const ContactsPage = () => {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchContacts = async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("name, email, phone_number, relationship");

      if (error) {
        console.error(error);
        setErrorMessage("Failed to load emergency contacts.");
        setIsLoadingContacts(false);
        return;
      }

      setContacts(
        (data ?? []).map((contact) => ({
          name: contact.name,
          email: contact.email,
          phoneNumber: contact.phone_number,
          relationship: contact.relationship,
        })),
      );
      setIsLoadingContacts(false);
    };

    fetchContacts();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhoneNumber = phoneNumber.trim();
    const trimmedRelationship = relationship.trim();

    if (!trimmedName || !trimmedPhoneNumber || !trimmedRelationship) {
      setErrorMessage("Please fill in all contact fields.");
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await supabase
      .from("contacts")
      .insert([
        {
          name: trimmedName,
          email: trimmedEmail,
          phone_number: trimmedPhoneNumber,
          relationship: trimmedRelationship,
        },
      ])
      .select("name, email, phone_number, relationship")
      .single();

    if (error) {
      console.error(error);
      setErrorMessage("Failed to save contact.");
      setIsSubmitting(false);
      return;
    }

    if (data) {
      setContacts((previousContacts) => [
        {
          name: data.name,
          email: data.email,
          phoneNumber: data.phone_number,
          relationship: data.relationship,
        },
        ...previousContacts,
      ]);
    }

    setName("");
    setEmail("");
    setPhoneNumber("");
    setRelationship("");
    setIsSubmitting(false);
  };

  return (
    <main className="w-full h-full p-8 bg-gray-50">
      <section className="w-full h-full bg-white border-2 border-gray-300 rounded-xl p-5">
        <h1 className="text-black font-semibold text-2xl">
          Add Trusted Contacts
        </h1>
        <span className="text-gray-500">
          These contacts will be notified during emergencies.
        </span>
        <form onSubmit={handleSubmit}>
          {errorMessage ? (
            <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
          ) : null}
          <label htmlFor="name" className="block text-black mt-4 font-semibold">
            Name
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full border-2 border-gray-300 text-black rounded-lg p-2 mt-1 placeholder:text-gray-500"
            placeholder="Enter contact name"
          />

          <label
            htmlFor="email"
            className="block mt-4 text-black font-semibold"
          >
            Email Address
          </label>

          <input
            type="email"
            id="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full border-2 border-gray-300 text-black rounded-lg p-2 mt-1 placeholder:text-gray-500"
            placeholder="Enter contact email"
          />

          <label
            htmlFor="phone"
            className="block mt-4 text-black font-semibold"
          >
            Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            className="w-full border-2 border-gray-300 text-black rounded-lg p-2 mt-1 placeholder:text-gray-500"
            placeholder="Enter contact phone number"
          />

          <label
            htmlFor="relationship"
            className="block mt-4 text-black font-semibold"
          >
            Relationship
          </label>
          <input
            type="text"
            id="relationship"
            value={relationship}
            onChange={(event) => setRelationship(event.target.value)}
            className="w-full border-2 border-gray-300 text-black rounded-lg p-2 mt-1 placeholder:text-gray-500"
            placeholder="Enter relationship (e.g., Family, Friend)"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-red-600 text-white rounded-lg p-3 mt-6 hover:bg-black-100 transition duration-300 flex items-center justify-center gap-2"
          >
            <GoPersonAdd />
            {isSubmitting ? "Adding Contact..." : "Add Contact"}
          </button>
        </form>
      </section>

      <section className="w-full h-full border-2 border-gray-300 rounded-lg p-8 bg-white mt-8">
        <h2 className="text-black font-semibold text-xl">Emergency Contacts</h2>
        {isLoadingContacts ? (
          <p className="mt-4 text-gray-500">Loading emergency contacts...</p>
        ) : contacts.length === 0 ? (
          <p className="mt-4 text-gray-500">No emergency contacts added yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {contacts.map((contact, index) => (
              <li
                key={`${contact.phoneNumber}-${index}`}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <p className="font-semibold text-black">{contact.name}</p>
                <p className="text-sm text-gray-700">{contact.email}</p>
                <p className="text-sm text-gray-700">{contact.phoneNumber}</p>
                <p className="text-sm text-gray-600">{contact.relationship}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};

export default ContactsPage;
