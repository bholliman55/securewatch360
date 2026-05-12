"use client";

import { useRouter } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Welcome to SecureWatch360</h1>
        <p className="mt-2 text-sm text-gray-500">Let&apos;s get your security posture set up in 5 minutes.</p>
      </div>
      <OnboardingWizard onComplete={() => router.push("/analyst")} />
    </div>
  );
}
