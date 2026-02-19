// deploy-test
"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createSupabaseBrowser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin() {
    setMessage("Prihlasujem...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("❌ " + error.message);
    } else {
      setMessage("✅ Prihlásený!");
      window.location.href = "/";
    }
  }

  async function handleRegister() {
    setMessage("Vytváram účet...");
  
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // po kliknutí v emaili pôjde user sem
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  
    if (error) {
      setMessage("❌ " + error.message);
    } else {
      setMessage("✅ Účet vytvorený! Skontroluj email a klikni na potvrdenie.");
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#020617",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "Arial"
    }}>

      <div style={{
        background: "#020617",
        padding: 40,
        borderRadius: 20,
        boxShadow: "0 0 40px rgba(0,0,0,0.6)",
        width: 380,
        textAlign: "center",
        border: "1px solid #1e293b"
      }}>

        <h1 style={{
          fontSize: 42,
          marginBottom: 10,
          color: "white"
        }}>
          🍽️ Fudly
        </h1>

        <p style={{
          color: "#94a3b8",
          marginBottom: 30
        }}>
          Prihlásenie do aplikácie
        </p>

        {/* EMAIL */}
        <input
          placeholder="Email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: 14,
            marginBottom: 15,
            borderRadius: 10,
            border: "1px solid #334155",
            background: "#020617",
            color: "white",
            fontSize: 16,
            outline: "none"
          }}
        />

        {/* PASSWORD */}
        <input
          type="password"
          placeholder="Heslo"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 14,
            marginBottom: 20,
            borderRadius: 10,
            border: "1px solid #334155",
            background: "#020617",
            color: "white",
            fontSize: 16,
            outline: "none"
          }}
        />

        {/* LOGIN */}
        <button
          onClick={handleLogin}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 10,
            border: "none",
            background: "#22c55e",
            color: "black",
            fontWeight: "bold",
            fontSize: 16,
            marginBottom: 10,
            cursor: "pointer"
          }}
        >
          Prihlásiť sa
        </button>

        {/* REGISTER */}
        <button
          onClick={handleRegister}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 10,
            border: "1px solid #334155",
            background: "transparent",
            color: "white",
            fontWeight: "bold",
            fontSize: 16,
            cursor: "pointer"
          }}
        >
          Vytvoriť účet
        </button>

        {/* MESSAGE */}
        {message && (
          <p style={{
            marginTop: 20,
            color: "#94a3b8",
            fontSize: 14
          }}>
            {message}
          </p>
        )}

      </div>
    </main>
  );
}
