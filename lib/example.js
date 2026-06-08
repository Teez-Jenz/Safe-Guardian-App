import { supabase } from "./supabase";

async function createUser() {
  const { data, error } = await supabase.from("users").insert([
    {
      name: "John Doe",
      email: "emmanueljejelowo@gmial.com",
      phone: "08089663211",
    },
  ]);

  console.log(data, error);
}
