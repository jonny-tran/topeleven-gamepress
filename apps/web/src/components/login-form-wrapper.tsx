"use client";

import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export default function LoginFormWrapper() {
  const [showSignIn, setShowSignIn] = useState(true);

  if (showSignIn) {
    return <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />;
  }
  return <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />;
}
